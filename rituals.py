import asyncio
from datetime import datetime, timezone
from glob import glob
import json
from datetime import datetime
from os import path

from aiohttp import web, ClientSession
import numpy as np
import cv2
from twilio import rest as twilio_rest
from twilio.jwt import access_token as twilio_access_token
from twilio.jwt.access_token import grants as twilio_grants

from core import app, active, users, tpl, random_token, Ritual, secrets, struct
from users import connectUserRitual

defaultimg = np.zeros((64,64,3),'uint8')
cv2.circle(defaultimg, (32,32), 24, (0,255,255), thickness=-1)
defaultjpg = bytes(cv2.imencode('.JPG', defaultimg)[1])


try:
    twilio_client_kwargs = {
        'username': secrets['TWILIO_API_KEY'],
        'password': secrets['TWILIO_API_SECRET'],
        'account_sid': secrets['TWILIO_ACCOUNT_SID'],
    }
except KeyError:
    twilio_client = None
else:
    twilio_client = twilio_rest.Client(**twilio_client_kwargs)


try:
    wowza_auth_headers = {
        'wsc-api-key': secrets['WOWZA_API_KEY'],
        'wsc-access-key': secrets['WOWZA_ACCESS_KEY'],
    }
except KeyError:
    wowza_auth_headers = None


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
    clientId = random_token()
    active[name].clients[clientId] = struct(
        chatQueue=asyncio.Queue(),
        lastSeen=datetime.now(),
        isStreamer=('streamer' in req.query),
    )
    for datum in active[name].allChats[-50:]:
        active[name].clients[clientId].chatQueue.put_nowait(datum)
    if hasattr(active[name], 'current_video_room'):
        async with active[name].video_room_lock:
            if not active[name].current_video_room:
                active[name].current_video_room = await asyncio.get_event_loop().run_in_executor(None, twilio_client.video.rooms.create)
            video_room_id = active[name].current_video_room.unique_name
            active[name].population_of_current_video_room += 1
            if active[name].population_of_current_video_room == 26:
                active[name].current_video_room = None
                active[name].population_of_current_video_room = 0
        token_builder = twilio_access_token.AccessToken(
            account_sid=secrets['TWILIO_ACCOUNT_SID'],
            signing_key_sid=secrets['TWILIO_API_KEY'],
            secret=secrets['TWILIO_API_SECRET'],
            identity=clientId,
        )
        token_builder.add_grant(twilio_grants.VideoGrant(room=video_room_id))
        active[name].clients[clientId].video_token = token_builder.to_jwt().decode()
        active[name].clients[clientId].room = video_room_id
    else:
        video_room_id = ''
        video_token = ''
    if hasattr(active[name],'participants') or hasattr(active[name], 'current_video_room'):
        for i,task in active[name].reqs.items():
            task.cancel()
    return web.Response(body=tpl('html/client.html',
                                 name=name,
                                 clientId=clientId,
                                 cclass=(
                                     'shrunk'
                                     if hasattr(active[name], 'participants')
                                     or video_room_id
                                     else ''
                                 ),
                                 ratio=str(active[name].ratio),
                                 islead=str(islead).lower(),
                                 bkgAll=str(active[name].bkgAll).lower(),
                                 rotate=str(active[name].rotate).lower(),
                                 videos=''.join(
                                     f'<video class="hidden" src="{video}" muted playsinline preload="auto"></video>'
                                     for video in active[name].videos
                                 )
                        ),
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

async def chatReceive(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    client = active[name].clients.get(req.query.get('clientId'))
    if not client:
        return web.Response(status=401)
    try:
        message = await asyncio.wait_for(client.chatQueue.get(), timeout=25)
    except asyncio.TimeoutError:
        message = None
    return web.Response(text=json.dumps({'message': message}), content_type='application/json')

async def chatSend(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    ritual = active[name]
    form = await req.post()
    text = form.get('text', '')
    if not isinstance(text, str) or text.strip()=='':
        return web.Response(status=400)
    sender = form.get('sender','Anonymous');
    datum = {'sender': sender, 'text': text}
    for client in ritual.clients.values():
        client.chatQueue.put_nowait(datum)
    ritual.allChats.append(datum)
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
    livestreams = {}
    videos = set()
    timestamp = datetime.now(timezone.utc).isoformat()
    async with ClientSession() as session:
        for slide_path in glob(f'examples/{script}/*.json'):
            filename = path.basename(slide_path)
            if filename == 'index.json':
                continue
            with open(slide_path) as f:
                slide = json.load(f)
            if slide['widget'] == 'Livestream':
                if not wowza_auth_headers:
                    raise KeyError('livestream requires Wowza secrets')
                async with session.post(
                    'https://api.cloud.wowza.com/api/v1.6/live_streams',
                    headers=wowza_auth_headers,
                    json={
                        'live_stream': {
                            'name': slide['name'] + '_' + timestamp,
                            'transcoder_type': 'transcoded',
                            'billing_mode': 'pay_as_you_go',
                            'broadcast_location': 'us_west_california',
                            'encoder': 'other_webrtc',
                            'aspect_ratio_width': 1920,
                            'aspect_ratio_height': 1080,
                            'recording': True,
                        },
                    },
                    ) as resp:
                    resp.raise_for_status()
                    livestream_json = await resp.json()
                livestream_data = livestream_json['live_stream']
                conn_info = livestream_data['source_connection_information']
                number, _ = path.splitext(filename)
                livestream = livestreams[int(number)] = struct(
                    livestream_id=livestream_data['id'],
                    playback_url=livestream_data['player_hls_playback_url'],
                    source_connection_information={
                        'sdpURL': conn_info['sdp_url'],
                        'applicationName': conn_info['application_name'],
                        'streamName': conn_info['stream_name'],
                    },
                )
                async with session.put(
                    f"https://api.cloud.wowza.com/api/v1.6/live_streams/{livestream.livestream_id}/start",
                    headers=wowza_auth_headers,
                    ) as resp:
                    resp.raise_for_status()
            elif slide['widget'] == 'BucketSinging':
                if 'videoUrl' in slide:
                    videos.add(slide['videoUrl'])
        async def livestream_started(livestream_id):
            async with session.get(
                f"https://api.cloud.wowza.com/api/v1.6/live_streams/{livestream_id}/state",
                headers=wowza_auth_headers,
                ) as resp:
                resp.raise_for_status()
                livestream_json = await resp.json()
            state = livestream_json['live_stream']['state']
            if state == 'starting':
                return False
            elif state == 'started':
                return True
            else:
                raise OSError(f'illegal livestream state: {state}')
        for livestream in livestreams.values():
            while not await livestream_started(livestream.livestream_id):
                await asyncio.sleep(1)
    active[name] = Ritual(script=script, reqs={}, state=None, page=page, background=opts['background'],
                          bkgAll=opts.get('bkgAll',False), ratio=opts.get('ratio',16/9), rotate=opts.get('rotate',True),
                          jpgs=[defaultjpg], jpgrats=[1], clients={}, allChats=[], livestreams=livestreams, videos=videos)
    if opts['showParticipants'] == 'avatars':
        active[name].participants = []
    elif opts['showParticipants'] == 'video':
        if not twilio_client:
            raise KeyError('participant video requires Twilio secrets')
        active[name].current_video_room = None
        active[name].population_of_current_video_room = 0
        active[name].video_room_lock = asyncio.Lock()
    print("did the thing")
    return web.HTTPFound('/'+name+'/lead')

async def setAvatar(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    ritual = active[name]
    clientId = req.match_info.get('client','')
    if clientId not in ritual.clients:
        return web.Response(status=404)
    client = ritual.clients[clientId]
    print("Set avatar for ritual %s, client %s"%(name,clientId))
    form = await req.post()
    if not hasattr(client,'jpg'):
        for i,task in active[name].reqs.items():
            task.cancel()        
    client.jpg = form['img'].file.read()
    return web.Response(status=204)    

async def getAvatar(req):
    name = req.match_info.get('name','')
    if name not in active:
        return web.Response(status=404)
    ritual = active[name]
    clientId = req.match_info.get('client','')
    if clientId not in ritual.clients:
        return web.Response(status=404)
    client = ritual.clients[clientId]
    print("Get avatar for ritual %s, client %s"%(name,clientId))
    if hasattr(client,'jpg'):
        jpg = client.jpg
        ma = 300
    else:
        jpg = open('unknownface.jpg','rb').read();
        ma = 0
    return web.Response(body=jpg, content_type='image/jpg', headers={'Cache-Control': 'max-age=%d'%ma})

app.router.add_get('/', homepage)
app.router.add_get('/{name}/partake', ritualPage)
app.router.add_get('/{name}/lead', ritualPage)
app.router.add_post('/{name}/nextPage', nextOrPrevPage)
app.router.add_post('/{name}/prevPage', nextOrPrevPage)
app.router.add_post('/{name}/skipSpeaker', skipSpeaker)
app.router.add_get('/{name}/chat/receive', chatReceive)
app.router.add_post('/{name}/chat/send', chatSend)
app.router.add_post('/mkRitual', mkRitual)
app.router.add_get('/{name}/bkg.jpg', background)
app.router.add_get('/{name}/namedimg/{img}', namedimg)
app.router.add_get('/{name}/clientAvatar/{client}', getAvatar)
app.router.add_post('/{name}/clientAvatar/{client}', setAvatar)
