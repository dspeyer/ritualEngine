import base64
import json
import os
import pathlib
import sys
import traceback
import asyncio
import urllib.parse
from datetime import datetime

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

try:
    sentry_dsn = secrets['SENTRY_DSN']
except KeyError:
    error_handler = '''
        <script>
            addEventListener('error', (event) => {
                event.preventDefault();
                // Not using jQuery here since it may not have loaded yet.
                let errDiv = document.createElement('div');
                errDiv.classList.add('error');
                errDiv.innerHTML = `
                    <h1>This app has crashed. We're really sorry :-(</h1>
                    <h2>Please <a href="https://github.com/dspeyer/ritualEngine/issues/new">file a bug</a> with the following information; it will help us fix it.</h2>
                    <textarea readonly></textarea>
                    <h2>Then refresh the page and try again.</h2>`;
                document.body.appendChild(errDiv);
                let {name, message, stack} = event.error ?? {};
                document.querySelector('textarea').textContent = stack ?? `${name}: ${message}`;
            });
            addEventListener('unhandledrejection', (event) => {
                event.preventDefault();
                throw event.reason;
            });
        </script>
    '''
else:
    sentry_public_key, _, _ = urllib.parse.urlparse(sentry_dsn).netloc.partition('@')
    error_handler = f'<script src="https://js.sentry-cdn.com/{sentry_public_key}.min.js" crossorigin="anonymous"></script>' + '''
        <script>
            Sentry.onLoad(() => {
                let showedReportDialog = false;
                Sentry.init({
                    sendDefaultPii: true,
                    autoSessionTracking: true,
                    beforeSend(event) {
                        if (event.exception && !showedReportDialog) {
                            showedReportDialog = true;
                            Sentry.showReportDialog({ eventId: event.event_id });
                        }
                        return event;
                    },
                });
            });
        </script>
    '''


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

room_created = {}

async def assign_twilio_room(ritual, clientId, force_new_room=False):
    async with ritual.video_room_lock:
        if force_new_room or not ritual.current_video_room:
            ritual.current_video_room = (
                await asyncio.get_event_loop().run_in_executor(None, twilio_client.video.rooms.create) )
            ritual.population_of_current_video_room = 0
            room_created[ritual.current_video_room.unique_name] = datetime.now()
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
