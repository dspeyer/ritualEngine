import sys
import os
from copy import copy
from random import random
from collections import defaultdict
from datetime import datetime, timedelta
import socket
import asyncio

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
        self.first_ready = datetime(9999, 1, 1, 1, 1, 1)
        self.justInit = justInit
        self.ready = False
        
        leader = getUserByEmail(leader)
        if leader:
            self.leader = leader.rid
        else:
            self.leader = None
        global mark_base
        mark_base += 1000

        seenThresh = datetime.now() - timedelta(seconds=30)
        self.c_expected = set([k for k,v in ritual.clients.items() if v.lastSeen > seenThresh])
        self.c_seen = set()
        self.c_ready = set()
        

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
        self.c_ready.add(data['clientId'])
        if self.first_ready == datetime(9999, 1, 1, 1, 1, 1):
            self.first_ready = datetime.now()
            self.sleeping_readiness_checker = asyncio.create_task(self.sleep_then_check_readiness())
        self.consider_readiness()

    async def sleep_then_check_readiness(self):
        asyncio.sleep(1.1)
        self.consider_readiness()
        asyncio.sleep(4)
        self.consider_readiness()
        
    def consider_readiness(self):
        seenThresh = datetime.now() - timedelta(seconds=30)
        self.c_expected = set([k for k,v in self.ritual.clients.items() if v.lastSeen > seenThresh])
        if self.ready:
            return
        elapsed = datetime.now() - self.first_ready
        if len(self.c_ready) >= len(self.c_expected):
            self.ready = True
        if (len(self.c_ready) >= len(self.c_seen)) and (elapsed > timedelta(seconds=1)):
            self.ready = True
        if elapsed > timedelta(seconds=5):
            self.ready = True
        if self.ready:
            for i,task in self.ritual.reqs.items():
                task.cancel()

        
    def to_client(self, clientId, have):
        self.c_seen.add(clientId)
        self.consider_readiness()
        return { 'widget': 'BucketSinging',
                 'lyrics': self.lyrics,
                 'boxColor': self.boxColor,
                 'server_url': PORT_FORWARD_PATH,
                 'ready': self.ready,
                 'slot': self.slots.get(clientId, 2),
                 'background_opts': self.background_opts,
                 "videoUrl": self.videoUrl,
                 'mark_base': mark_base,
                 'leader': self.leader,
                 'backing_track': self.backing or False,
                 'justInit': self.justInit,
                 'dbginfo': '%d/%d/%d'%(len(self.c_ready),len(self.c_seen),len(self.c_expected))}

    @staticmethod
    async def preload(ritual, videoUrl=None, **ignore):
        if videoUrl:
            ritual.videos.add(videoUrl)

    def destroy(self):
        if hasattr(self,'sleeping_readiness_checker') and not self.sleeping_readiness_checker.done():
            self.sleeping_readiness_checker.cancel()

