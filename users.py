import json
from base64 import b64decode

from aiohttp import web, ClientSession
import numpy as np
import cv2

from core import app, error_handler, users, struct, tpl

async def addLogin(req):
    return web.Response(body=open('html/login.html').read(), content_type='text/html')                

async def manageLogins(req):
    return web.Response(body=tpl('html/manage.html', errorhandler=error_handler), content_type='text/html')                

async def dbgLoginPage(req):
    return web.Response(body=open('html/login.html').read(), content_type='text/html')

async def getAvatar(form, rid=None):
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
    elif form['photosource'] == 'keep':
        return users[rid].img
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
    alpha = img[:,:,0] * 0
    cv2.circle(alpha, (50,50), 50, (255,), thickness=-1)
    alpha = cv2.GaussianBlur(alpha, (5,5), 0)
    alpha = np.expand_dims(alpha,axis=2)
    img = np.concatenate((img, alpha), axis=2)
    return bytes(cv2.imencode('.PNG', img)[1])

async def dbgLogin(req):
    for k,v in req.raw_headers:
        print('%s: %s'%(k,v))
    form = await req.post()
    img = await getAvatar(form)
    return web.Response(body=img, content_type='image/png')

async def login(req):
    form = await req.post()
    email = form['email']
    name = form['name']
    rid = np.base_repr(hash(email), 36)
    img = await getAvatar(form, rid)
    users[rid] = struct(name=name, img=img, email=email, rid=rid)
    logins = req.cookies.get('ritLogin')
    if logins:
        logins = logins.split('__')
    else:
        logins = []
    print("logins: ",logins)
    logins = [ l for l in logins if l in users ]
    print("logins: ",logins)
    logins.append(rid)
    print("logins: ",logins)
    url = req.url
    if url.path == '/addLogin':
        url = str(url).replace('/addLogin','/manageLogins') # Curse the URL class's immutability
    res = web.HTTPFound(url)
    res.set_cookie('ritLogin', '__'.join(logins))
    return res

def getUserByEmail(email):
    rid = np.base_repr(hash(email), 36)
    return users.get(rid)

async def userinfo(req):
    rid = req.query.get('id')
    if not rid:
        email = req.query.get('email')
        rid = np.base_repr(hash(email), 36)
    if rid in users:
        out = { 'found': True,
                'hash': rid,
                'name': users[rid].name,
                'email': users[rid].email }
    else:
        out = { 'found': False }
    return web.Response(text=json.dumps(out), content_type="text/json")

async def displayAvatar(req):
    user = req.match_info.get('user')
    return web.Response(body=users[user].img, content_type='image/png')

def connectUserRitual(req, ritual, islead):
    foundLogin = False
    logins = req.cookies.get('ritLogin')
    if logins:
        for login in logins.split('__'):
            if login in users:
                foundLogin = True
                if login not in ritual.participants:
                    if islead:
                        ritual.participants.insert(0,login)
                    else:
                        ritual.participants.append(login)
        for i,task in ritual.reqs.items():
            task.cancel()
    return foundLogin

app.router.add_get('/login', dbgLoginPage)
app.router.add_post('/login', dbgLogin)
app.router.add_post('/{name}/partake', login)
app.router.add_post('/{name}/lead', login)
app.router.add_get('/avatar/{user}.png', displayAvatar)
app.router.add_get('/userinfo', userinfo)
app.router.add_get('/addLogin', addLogin)
app.router.add_post('/addLogin', login)
app.router.add_get('/manageLogins', manageLogins)
