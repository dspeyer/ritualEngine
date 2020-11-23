import asyncio
import json
import pathlib

from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VideoGrant
from twilio.rest import Client

from core import random_token, secrets

try:
    twilio_client = Client(username=secrets['TWILIO_API_KEY'],
                           password=secrets['TWILIO_API_SECRET'], account_sid=secrets['TWILIO_ACCOUNT_SID'])
except KeyError as e:
    print("WARNING: Videoconference Widget will not work without secrets")



def call_async(function, *args):
    return asyncio.get_event_loop().run_in_executor(None, function, *args)


class Videoconference(object):
    def __init__(self, **ignore):
        self.clients = {}

    async def async_init(self):
        self.room = await call_async(twilio_client.video.rooms.create)

    def to_client(self, clientId, have):
        if clientId in self.clients:
            token = self.clients[clientId]
        else:
            token_builder = AccessToken(account_sid=secrets['TWILIO_ACCOUNT_SID'], signing_key_sid=secrets['TWILIO_API_KEY'],
                                        secret=secrets['TWILIO_API_SECRET'], identity=random_token())
            token_builder.add_grant(VideoGrant(room=self.room.unique_name))
            token = token_builder.to_jwt().decode()
            self.clients[clientId] = token
        return {'widget': 'Videoconference', 'roomId': self.room.unique_name, 'token': token}

    def from_client(self, data, users):
        pass
