import sys
import os
from copy import copy
from random import random
from collections import defaultdict
from datetime import datetime, timedelta
import socket
import asyncio
from asyncio.subprocess import PIPE, STDOUT, DEVNULL

from aiohttp import web

from users import getUserByEmail

BUCKET_PATH = os.environ.get('BUCKET_PATH','../solstice-audio-test')
PORT_FORWARD_PATH = os.environ.get('PORT_FORWARD_PATH', '/api')

mark_base = 1000;

class BucketSinging(object):
    def __init__(self, ritual, boxColor, lyrics, bsBkg=None, leader=None, backing=None, videoUrl=None, justInit=False, **ignore):
        self.ritual = ritual
        self.boxColor = boxColor
        self.lyrics = lyrics
        self.client_ids = []
        self.background_opts = (bsBkg or {})
        self.videoUrl = videoUrl
        self.backing = backing
        self.slots = {}
        self.slot_sizes = defaultdict(int)
        self.nready = 0
        self.first_ready = datetime(9999, 1, 1, 1, 1, 1)
        self.justInit = justInit
        
        leader = getUserByEmail(leader)
        if leader:
            self.leader = leader.rid
        else:
            self.leader = None
        global mark_base
        mark_base += 1000
        

    @staticmethod
    def piece(req):
        fn = req.match_info.get('fn')
        content = open(os.path.join(BUCKET_PATH,'html',fn), 'rb').read()
        return web.Response(body=content, content_type='text/javascript')

    def from_client(self, data, users):
        print("client data is",data)
        if data['islead']=='true':
            slot = 0
        elif data['calibrationFail']=='true':
            slot = 2
        elif random() < 30.0/len(self.ritual.clients)  and  self.slot_sizes[1] < 30:
            slot = 1
        else:
            slot = 2
        self.slots[data['clientId']] = slot
        self.slot_sizes[slot] += 1
        self.nready += 1
        if self.first_ready == datetime(9999, 1, 1, 1, 1, 1):
            self.first_ready = datetime.now()

        
    def to_client(self, clientId, have):
        ready = self.nready >= len(self.ritual.clients)  or  datetime.now() - self.first_ready > timedelta(seconds=5)
        return { 'widget': 'BucketSinging',
                 'lyrics': self.lyrics,
                 'boxColor': self.boxColor,
                 'server_url': PORT_FORWARD_PATH,
                 'ready': ready,
                 'slot': self.slots.get(clientId, 2),
                 'background_opts': self.background_opts,
                 "videoUrl": self.videoUrl,
                 'mark_base': mark_base,
                 'leader': self.leader,
                 'backing_track': self.backing or False,
                 'justInit': self.justInit,
                 'dbginfo': '%d/%d'%(self.nready,len(self.ritual.clients))}

        
