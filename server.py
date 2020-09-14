#!/usr/bin/env python

from glob import glob
from os import path
import json
from base64 import b64decode

from asyncio import run, create_task, sleep, CancelledError
from aiohttp import web, ClientSession
import numpy as np
import cv2

from widgets.PhotoCollage import PhotoCollage
from widgets.Histogram import Histogram
from widgets.CrossWords import CrossWords
from widgets.BucketSinging import BucketSinging


defaultimg = np.zeros((64,64,3),'uint8')
cv2.circle(defaultimg, (32,32), 24, (0,255,255), thickness=-1)
defaultjpg = bytes(cv2.imencode('.JPG', defaultimg)[1])

class struct:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

active = {}
users = {}

# TODO: real templating system?
def tpl(fn, **kwargs):
    s = open(fn).read()
    for k,v in kwargs.items():
        s = s.replace('%'+k+'%', v)
    return s
    
async def homepage(req):
    l = '\n'.join([ '<li><a href="/%s/partake">%s (%s)</a>'%(x,x,active[x].script) for x in active.keys() ])
    s = '\n'.join([ '<option>%s</option>'%(x.replace('examples/','')) for x in glob('examples/*') ])
    html = tpl('html/index.html', list=l, scripts=s)
    return web.Response(text=html, content_type='text/html')

async def ritualPage(req):
    name = req.match_info.get('name','error')
    if name not in active:
        return web.Response(text="Not Found", status=404)
    if hasattr(active[name],'participants'):
        login = req.cookies.get('ritLogin')
        if login and login in users:
            if login not in active[name].participants:
                active[name].participants.append(login)
                for i,task in active[name].reqs.items():
                    task.cancel()
        else:
            return web.Response(body=open('html/login.html').read(), content_type='text/html')            
    return web.Response(body=tpl('html/client.html',
                                 name=name,
                                 cclass=hasattr(active[name],'participants') and 'shrunk' or ''),
                        content_type='text/html', charset='utf8')

async def dbgLoginPage(req):
    return web.Response(body=open('html/login.html').read(), content_type='text/html')

async def getAvatar(form):
    if form['photosource'] == 'file':
        jpg = form['photofile'].file.read()
    elif form['photosource'] == 'selfie':
        dataurl = form['selfie']
        header, encoded = dataurl.split(",", 1)
        jpg = b64decode(encoded)
    elif form['photosource'] == 'url':
        url = form['photourl']
        client = ClientSession()
        resp = await client.get(url)
        jpg = await resp.read()
    else:
        raise ValueError("Unrecognized photosource '%s'"%form['photosource'])
    npjpg = np.asarray(bytearray(jpg), dtype="uint8")
    img = cv2.imdecode(npjpg, cv2.IMREAD_COLOR)
    (w,h,_) = img.shape
    z = float(form['zoom'])
    z = 2 ** (z/5)
    img = cv2.resize(img, dsize=(int(h*z), int(w*z)))
    x = int(float(form['x']))
    y = int(float(form['y']))
    img = img[y:y+100, x:x+100]
    alpha = img[:,:,0:1] * 0
    cv2.circle(alpha, (50,50), 50, (255,), thickness=-1)
    img = np.concatenate((img, alpha), axis=2)
    return bytes(cv2.imencode('.PNG', img)[1])

async def dbgLogin(req):
    for k,v in req.raw_headers:
        print('%s: %s'%(k,v))
    form = await req.post()
    img = await getAvatar(form)
    return web.Response(body=img, content_type='image/png')

async def ritualPageLogin(req):
    form = await req.post()
    email = form['email']
    name = form['name']
    img = await getAvatar(form)
    rid = np.base_repr(hash(email), 36)
    users[rid] = struct(name=name, img=img)
    res = web.HTTPFound(req.url)
    res.set_cookie('ritLogin', rid)
    return res

async def displayAvatar(req):
    user = req.match_info.get('user')
    return web.Response(body=users[user].img, content_type='image/png')

async def lib(req):
    return web.Response(body=open('html/lib.js').read(), content_type='text/javascript')

async def getJs(req):
    fn = req.match_info.get('fn')
    return web.Response(body=open('widgets/'+fn).read(), content_type='text/javascript', charset='utf-8')

async def jpg(req):
    name = req.match_info.get('name')
    imgid = req.match_info.get('id')
    return web.Response(body=active[name].jpgs[int(imgid)], content_type='image/jpeg')

async def widgetPiece(req):
    # TODO: security
    widget = globals()[req.match_info.get('widget')]
    return widget.piece(req)

async def background(req):
    name = req.match_info.get('name')
    sc = active[name].script
    fn = active[name].background
    path = 'examples/%s/%s'%(sc,fn)
    content = open(path,'rb').read()
    return web.Response(body=content, content_type='image/jpeg');   

async def mkRitual(req):
    print("mkRitual")
    form = await req.post()
    print(form)
    try:
        name = form['name']
        script = form['script']
    except KeyError:
        return web.Response(text='Bad Form',status=400)
    page = int(form.get('page',1))
    print("good")
    if name in active:
        return web.Response(text='Duplicate',status=400)
    opts = json.loads(open('examples/%s/index.json'%script).read())
    print("very good")
    active[name] = struct(script=script, reqs={}, state=None, page=page, background=opts['background'],
                          jpgs=[defaultjpg], jpgrats=[1])
    if opts['showParticipants']:
        active[name].participants = []
    print("did the thing")
    return web.HTTPFound('/'+name+'/partake')

sleepid=0
async def status(req):
    print("status from %s (have %s)"%(req.headers['User-Agent'].strip().split(' ')[-1],req.query.get('have')))
    global sleepid
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    ritual = active[name]
    have = int(req.query.get('have'))
    subhave = req.query.get('subhave')
    if ( have==ritual.page and
         ( not ritual.state or not hasattr(ritual.state,'subpagesame') or ritual.state.subpagesame(subhave) ) ):
        sleepid += 1
        myid = sleepid
        sleeptask = create_task(sleep(25))
        ritual.reqs[myid] = sleeptask
        print("starting sleep %d"%myid)
        try:
            await sleeptask
            print("sleep %d finished"%myid)
        except CancelledError:
            print("sleep %d canceled"%myid)
            pass
        del ritual.reqs[myid]
    results={}
    if ritual.page != have:
        fn = 'examples/%s/%d.svg'%(ritual.script,ritual.page)
        if path.exists(fn):
            svg = open(fn).read()
            results['svg'] = svg
        else:
            results['error'] = 'no background'
        fn = 'examples/%s/%d.json'%(ritual.script,ritual.page)
        if not ritual.state and path.exists(fn):
            try:
                data = json.loads(open(fn).read())
                widget = globals()[data['widget']]
                ritual.state = widget(ritual=ritual, **data)
                if hasattr(ritual.state,'async_init'):
                    await ritual.state.async_init()
            except Exception as e:
                results['error'] = str(e)
        results['page'] = ritual.page
    if ritual.state:
        results.update(ritual.state.to_client(req.query.get('internalhave')))
    if hasattr(ritual,'participants'):
        results['participants'] = [ {'name':users[p].name, 'img':'/avatar/%s.png'%p} for p in ritual.participants ]
    print(results.keys())
    return web.Response(text=json.dumps(results), content_type='application/json')

async def widgetData(req):
    print("widgetData")
    for k,v in req.headers.items():
        print("  %s: %s"%(k,v))
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    print("found")
    if not active[name].state:
        return web.Response(status=404)
    print("found state")
    data = await req.post()
    print("Data keys are %s"%data.keys())
    ip = req.headers['X-Forwarded-For']
    active[name].state.from_client(data=data,ip=ip)
    for i,task in active[name].reqs.items():
        print("Cancelling %d"%i)
        task.cancel()
    return web.Response(status=204)    

async def nextPage(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    if active[name].state and hasattr(active[name].state,'destroy'):
        active[name].state.destroy()
    active[name].state = None
    active[name].page += 1
    for i,task in active[name].reqs.items():
        print("Cancelling %d"%i)
        task.cancel()
    return web.HTTPFound('/'+name+'/')

async def stateDbg(req):
    name = req.match_info.get('name','')
    state = active[name].state
    return web.Response(body=state.get_dbg(),content_type="image/png")

app = web.Application()
app.router.add_get('/', homepage)
app.router.add_get('/login', dbgLoginPage)
app.router.add_post('/login', dbgLogin)
app.router.add_get('/lib.js', lib)
app.router.add_get('/{name}/partake', ritualPage)
app.router.add_post('/{name}/partake', ritualPageLogin)
app.router.add_get('/widgets/{fn}', getJs)
app.router.add_post('/mkRitual', mkRitual)
app.router.add_get('/{name}/status', status)
app.router.add_get('/{name}/bkg.jpg', background)
app.router.add_post('/{name}/nextPage', nextPage)
app.router.add_post('/{name}/widgetData', widgetData)
app.router.add_get('/widgets/{widget}/{fn}', widgetPiece)
app.router.add_get('/{name}/img/{id}.jpg', jpg)
app.router.add_get('/{name}/dbg.png', stateDbg)
app.router.add_get('/avatar/{user}.png', displayAvatar)


web.run_app(app)
