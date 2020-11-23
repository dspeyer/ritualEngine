import base64
import json
import os
import pathlib
import sys

from aiohttp import web

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
    raise FileNotFoundError('secrets.json not found; see README.md for more info') from e
with open(root_dir / 'secrets.example.json') as f:
    example_secrets = json.load(f)
missing_secrets = example_secrets.keys() - secrets.keys()
if missing_secrets:
    raise KeyError('secrets.json missing keys: ' + ', '.join(missing_secrets))

# TODO: real templating system?
def tpl(fn, **kwargs):
    s = open(fn).read()
    for k,v in kwargs.items():
        s = s.replace('%'+k+'%', v)
    return s

def random_token():
    return base64.urlsafe_b64encode(os.urandom(256 // 8)).decode().strip('=')

app = web.Application()

