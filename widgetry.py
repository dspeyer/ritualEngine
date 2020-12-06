from os import path
import json
from datetime import datetime, timedelta
from asyncio import create_task, sleep, CancelledError

from aiohttp import web

from core import app, active, users, struct

from widgets.PhotoCollage import PhotoCollage
from widgets.Histogram import Histogram
from widgets.CrossWords import CrossWords
from widgets.BucketSinging import BucketSinging
from widgets.Trivia import Trivia
from widgets.CircleFlames import CircleFlames
from widgets.Youtube import Youtube

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

# audioCtx.audioWorklet.addModule does not handle relative paths correctly
# So audio-worklet.js always shows up under the ritual directory
# And not the widget directory where it belongs
# There was a workaround for this in app.js, but it got lost in the Great Refactoring
async def hideousHackAudioWorklet(req):
    return BucketSinging.piece(req)

sleepid=0
async def status(req):
    print("status from %s (have %s)"%(req.headers['User-Agent'].strip().split(' ')[-1],req.query.get('have')))
    global sleepid
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    ritual = active[name]
    clientId = req.query.get('clientId')
    ritual.clients[clientId].lastSeen = datetime.now()
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
        if path.exists(fn):
            try:
                data = json.loads(open(fn).read())
                print(data)
            except Exception as e:
                print("fn='%s"%fn)
                raise e
        else:
            data = {}

        if 'widget' in data and not ritual.state:
            widget = globals()[data['widget']]
            ritual.state = widget(ritual=ritual, **data)
            if hasattr(ritual.state,'async_init'):
                await ritual.state.async_init()

        for key in ['background', 'bkZoom', 'bkZoomCenter']:
            if key in data:
                results[key] = data[key]

        results['twilioAudioEnabled'] = data.get('twilioAudioEnabled', False);
                
        results['page'] = ritual.page
        
    if ritual.state:
        results.update(ritual.state.to_client(clientId, req.query.get('internalhave')))
    if hasattr(ritual,'participants'):
        results['participants'] = [ {'name':users[p].name, 'img':'/avatar/%s.png'%p} for p in ritual.participants ]
    if hasattr(ritual,'current_video_room'):
        results['video_token'] = ritual.clients[clientId].video_token
        results['room'] = ritual.clients[clientId].room
        seenThresh = datetime.now() - timedelta(seconds=30)
        results['clients'] = [ { 'id':k, 'room':v.room, 'hj':hasattr(v,'jpg') }
                               for k,v in ritual.clients.items()
                               if v.lastSeen > seenThresh] # TODO: ordering?
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
    login = req.cookies.get('ritLogin')
    if login:
        login = login.split('__')
    else:
        ip = req.headers['X-Forwarded-For']
        login = ['anon' + ip]
    active[name].state.from_client(data=data,users=login)
    for i,task in active[name].reqs.items():
        print("Cancelling %d"%i)
        task.cancel()
    return web.Response(status=204)    



async def stateDbg(req):
    name = req.match_info.get('name','')
    state = active[name].state
    return web.Response(body=state.get_dbg(),content_type="image/png")

    

app.router.add_get('/lib.js', lib)
app.router.add_get('/widgets/{fn}', getJs)
app.router.add_get('/{name}/status', status)
app.router.add_post('/{name}/widgetData', widgetData)
app.router.add_get('/widgets/{widget}/{fn}', widgetPiece)
app.router.add_get(r'/{name:[^/]*}/{fn:audio-worklet.js|audiochunk.js|lib.js|worker-encoder.js|worker-decoder.js|opusjs/.*}', hideousHackAudioWorklet)
app.router.add_get('/{name}/img/{id}.jpg', jpg)
app.router.add_get('/{name}/dbg.png', stateDbg)
