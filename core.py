import base64
import json
import os
import pathlib
import sys
import traceback
import asyncio

from aiohttp import web

from twilio import rest as twilio_rest
from twilio.jwt import access_token as twilio_access_token
from twilio.jwt.access_token import grants as twilio_grants

class struct:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

class Ritual(struct):
    def __init__(self, **kwargs):
        super(Ritual, self).__init__(**kwargs)
    def rotateSpeakers(self):
        if not self.rotate:
            return
        if hasattr(self,'participants') and len(self.participants)>1:
            first = self.participants[0]
            self.participants = self.participants[1:]
            self.participants.append(first)

active = {}
users = {}

# Validate secrets.json early because this is likely to come up if someone is
# checking out and building the codebase for the first time, or just pulled
# from master, and we want to give them useful error messages.
root_dir = pathlib.Path(__file__).parent
try:
    with open(root_dir / 'secrets.json') as f:
        secrets = json.load(f)
except FileNotFoundError as e:
    print('WARNING: secrets.json not found; see README.md for more info')
    secrets = {}
except json.decoder.JSONDecodeError as e:
    raise FileNotFoundError('secrets.json malformed') from e
with open(root_dir / 'secrets.example.json') as f:
    example_secrets = json.load(f)
missing_secrets = example_secrets.keys() - secrets.keys()
if missing_secrets:
    print('WARNING: Missing secrets: ' + ', '.join(missing_secrets) + ' -- some features will not work!')

# TODO: real templating system?
def tpl(fn, **kwargs):
    s = open(fn).read()
    for k,v in kwargs.items():
        s = s.replace('%'+k+'%', v)
    return s

def random_token():
    return base64.urlsafe_b64encode(os.urandom(256 // 8)).decode().strip('=')

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

MAX_IN_TWILIO_ROOM = 25

async def assign_twilio_room(ritual, clientId, force_new_room=False):
    async with ritual.video_room_lock:
        if force_new_room or not ritual.current_video_room:
            ritual.current_video_room = (
                await asyncio.get_event_loop().run_in_executor(None, twilio_client.video.rooms.create) )
            ritual.population_of_current_video_room = 0
        video_room_id = ritual.current_video_room.unique_name
        ritual.population_of_current_video_room += 1
        if ritual.population_of_current_video_room >= MAX_IN_TWILIO_ROOM + 1:
            ritual.current_video_room = None
            ritual.population_of_current_video_room = 0
    token_builder = twilio_access_token.AccessToken(
        account_sid=secrets['TWILIO_ACCOUNT_SID'],
        signing_key_sid=secrets['TWILIO_API_KEY'],
        secret=secrets['TWILIO_API_SECRET'],
        identity=clientId,
    )
    token_builder.add_grant(twilio_grants.VideoGrant(room=video_room_id))
    ritual.clients[clientId].video_token = token_builder.to_jwt().decode()
    ritual.clients[clientId].room = video_room_id
    print("Assigned %s to %s"%(clientId,video_room_id))



@web.middleware
async def errorHandler(request, handler):
    try:
        return await handler(request)
    except Exception as e:
        txt = '%s\n%s\n\n%s'%(type(e).__name__,str(e),traceback.format_exc())
        print('\n'+txt+'\n')
        return web.Response(text=txt, status=500, content_type="text/plain")

app = web.Application(middlewares=[errorHandler])
