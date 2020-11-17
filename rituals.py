from glob import glob
import json

from aiohttp import web
import numpy as np
import cv2

from core import app, active, users, tpl, Ritual
from users import connectUserRitual

defaultimg = np.zeros((64,64,3),'uint8')
cv2.circle(defaultimg, (32,32), 24, (0,255,255), thickness=-1)
defaultjpg = bytes(cv2.imencode('.JPG', defaultimg)[1])


async def homepage(req):
    l = '\n'.join([ '<li><a href="/%s/partake">%s (%s)</a>'%(x,x,active[x].script) for x in active.keys() ])
    s = '\n'.join([ '<option>%s</option>'%(x.replace('examples/','')) for x in glob('examples/*') ])
    html = tpl('html/index.html', list=l, scripts=s)
    return web.Response(text=html, content_type='text/html')

async def ritualPage(req):
    name = req.match_info.get('name','error')
    if name not in active:
        return web.Response(text="Not Found", status=404)
    islead = req.url.path.endswith('/lead')
    if hasattr(active[name],'participants'):
        foundLogin = connectUserRitual(req, active[name], islead)
        if not foundLogin:
            res = web.Response(body=open('html/login.html').read(), content_type='text/html')
            res.set_cookie('LastRitual', name)
            return res
    return web.Response(body=tpl('html/client.html',
                                 name=name,
                                 cclass=hasattr(active[name],'participants') and 'shrunk' or '',
                                 ratio=str(active[name].ratio),
                                 islead=str(islead).lower(),
                                 bkgAll=str(active[name].bkgAll).lower(),
                                 rotate=str(active[name].rotate).lower()),
                        content_type='text/html', charset='utf8')

async def nextOrPrevPage(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    isnext = req.url.path.endswith('/nextPage')
    if active[name].state:
        if hasattr(active[name].state,'destroy'):
            active[name].state.destroy()
    elif isnext:
        active[name].rotateSpeakers()
    active[name].state = None
    active[name].page += (isnext and 1 or -1)
    for i,task in active[name].reqs.items():
        print("Cancelling %d"%i)
        task.cancel()
    return web.Response(status=204)

async def skipSpeaker(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    active[name].rotateSpeakers()
    for i,task in active[name].reqs.items():
        print("Cancelling %d"%i)
        task.cancel()
    return web.Response(status=204)


async def background(req):
    name = req.match_info.get('name')
    sc = active[name].script
    fn = active[name].background
    path = 'examples/%s/%s'%(sc,fn)
    content = open(path,'rb').read()
    return web.Response(body=content, content_type='image/jpeg');   

async def namedimg(req):
    name = req.match_info.get('name')
    fn = req.match_info.get('img')
    sc = active[name].script
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
    active[name] = Ritual(script=script, reqs={}, state=None, page=page, background=opts['background'],
                          bkgAll=opts.get('bkgAll',False), ratio=opts.get('ratio',16/9), rotate=opts.get('rotate',True),
                          jpgs=[defaultjpg], jpgrats=[1])
    if opts['showParticipants']:
        active[name].participants = []
    print("did the thing")
    return web.HTTPFound('/'+name+'/partake')

app.router.add_get('/', homepage)
app.router.add_get('/{name}/partake', ritualPage)
app.router.add_get('/{name}/lead', ritualPage)
app.router.add_post('/{name}/nextPage', nextOrPrevPage)
app.router.add_post('/{name}/prevPage', nextOrPrevPage)
app.router.add_post('/{name}/skipSpeaker', skipSpeaker)
app.router.add_post('/mkRitual', mkRitual)
app.router.add_get('/{name}/bkg.jpg', background)
app.router.add_get('/{name}/namedimg/{img}', namedimg)
