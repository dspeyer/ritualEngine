import sys
import os
from copy import copy
import random
from collections import defaultdict
from datetime import datetime, timedelta
import json
from itertools import count
import socket
import asyncio
from urllib.parse import quote

from aiohttp import web, ClientSession

from users import getUserByEmail
from core import secrets, assign_twilio_room

BUCKET_PATH = os.environ.get('BUCKET_PATH','../solstice-audio-test')
BUCKET_SINGING_URL = secrets.get('BUCKET_SINGING_URL', '/api')

class BucketSinging(object):
    def __init__(self, ritual, lyrics, boxColor=None, boxColors=None, bsBkg=None, leader=None, backing=None, videoUrl=None, justInit=False, lyricTimings=None, muteTimings=(), unmuteTimings=(), startMuted=False, roundVideo=True, **ignore):
        self.ritual = ritual
        if boxColors:
            self.boxColors = boxColors
        elif boxColor:
            self.boxColors = {'lyrics':boxColor, 'video':boxColor}
        else:
            raise ValueError('Box Colors Needed')
        self.lyrics = lyrics
        self.client_ids = []
        self.background_opts = (bsBkg or {})
        self.videoUrl = videoUrl
        self.backing = backing
        self.slots = {}
        self.slot_sizes = defaultdict(int)
        self.first_ready = datetime(9999, 1, 1, 1, 1, 1)
        self.justInit = justInit
        self.lyricTimings = lyricTimings
        self.muteTimings = muteTimings
        self.unmuteTimings = unmuteTimings
        self.startMuted = startMuted
        self.roundVideo = roundVideo
        self.ready = False
        
        leader = getUserByEmail(leader)
        if leader:
            self.leader = leader.rid
        else:
            self.leader = None

        seenThresh = datetime.now() - timedelta(seconds=30)
        self.c_expected = set([k for k,v in ritual.clients.items() if v.lastSeen > seenThresh])
        self.c_seen = set()
        self.c_ready = set()
        self.c_slideLeader = set()
        self.c_uncalibrated = set()
        self.c_songLeader = set()
        

    @staticmethod
    def piece(req):
        fn = req.match_info.get('fn')
        content = open(os.path.join(BUCKET_PATH,'html',fn), 'rb').read()
        return web.Response(body=content, content_type='text/javascript')

    def from_client(self, data, users):
        clientId = data['clientId']        
        action = data['action']
        if action == 'ready':
            self.from_client_ready(clientId,data)
        if action == 'pickslot':
            self.from_client_pickslot(clientId,data)

    def from_client_ready(self, clientId, data):
        self.c_ready.add(data['clientId'])
        if self.ready:
            # Late arrivals
            if data['calibrationFail']=='true':
                self.slots[clientId] = 3
            else:
                self.slots[clientId] = 2
            return
        if data['islead']=='true':
            self.c_slideLeader.add(clientId)
        if data['calibrationFail']=='true':
            self.c_uncalibrated.add(clientId)
        if self.leader and self.leader in users:
            self.c_songLeader.add(clientId)
        if self.first_ready == datetime(9999, 1, 1, 1, 1, 1):
            self.first_ready = datetime.now()
            self.sleeping_readiness_checker = asyncio.create_task(self.sleep_then_check_readiness())
        self.consider_readiness()

    def from_client_pickslot(self, clientId, data):
        slot = int(data['slot'])
        self.slots[clientId] = slot
        for i,task in self.ritual.reqs.items():
            task.cancel()
        
        
    async def sleep_then_check_readiness(self):
        await asyncio.sleep(1.1)
        self.consider_readiness()
        await asyncio.sleep(4)
        self.consider_readiness()
        

    def consider_readiness(self):
        print("Checking readiness %d/%d/%d -- %.1f seconds" % (len(self.c_ready),len(self.c_seen),len(self.c_expected), (self.first_ready-datetime.now()).total_seconds()))
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
            self.assign_slots()
            asyncio.create_task(self.start_song())
            for i,task in self.ritual.reqs.items():
                task.cancel()

    def assign_slots(self):
        needsLeader = (self.leader or (self.lyrics and not self.lyricTimings) or (not self.backing))
        if needsLeader:
            if not self.c_songLeader:
                for cid in self.c_slideLeader:
                    self.c_songLeader.add(cid)
            if not self.c_songLeader:
                victim = random.choice(list(self.c_ready))
                self.c_songLeader.add(victim)
            for cid in self.c_songLeader:
                self.slots[cid] = 0
        else:
            self.c_songLeader = set()
            for cid in self.c_slideLeader:
                self.slots[cid] = 3
        for cid in self.c_uncalibrated:
            if not cid in self.slots:
                self.slots[cid]=3
        # TODO: don't put the same people in early slots repeatedly
        toplace = list(self.c_ready - set(self.slots.keys()))
        random.shuffle(toplace)
        n = len(toplace)
        if needsLeader:
            b01 = 0
            b12 = min(max(n//3,1), 5)
            b23 = min(max(2*n//3,b12+1), 35)
        else:
            b01 = min(max(n//15,1), 30)
            b12 = min(max(n//5,b01+1), 130)
            b23 = min(max(n//2,b12), 330)
        for cid in toplace[:b01]:
            self.slots[cid] = 0
        for cid in toplace[b01:b12]:
            self.slots[cid] = 1
        for cid in toplace[b12:b23]:
            self.slots[cid] = 2
        for cid in toplace[b23:]:
            self.slots[cid] = 3
        if hasattr(self.ritual,'current_video_room'):
            asyncio.create_task(self.reset_twilio())

    async def reset_twilio(self):
        cbs = defaultdict(list)
        for client,slot in self.slots.items():
            cbs[slot].append(client)
        for slot,clients in cbs.items():
            random.shuffle(clients)
            first = True
            for client in clients:
                await assign_twilio_room(self.ritual, client, force_new_room=first)
                first = False
        for i,task in self.ritual.reqs.items():
            task.cancel()

            
    async def start_song(self):
        if hasattr(self,'sent_start_cmds'):
            return
        self.sent_start_cmds = True
        if BUCKET_SINGING_URL.startswith('http'):
            server = BUCKET_SINGING_URL
        else:
            server = 'http://localhost:8001'+BUCKET_SINGING_URL
        if server.endswith('/'):
            server=server[:-1]
        client = ClientSession()
        url = server + '/?mark_stop_singing=1'
        print("POSTING "+url)
        resp = await client.post(url)
        print("response: "+(await resp.read()).decode())
        url = server + '/?mark_start_singing=1'
        if self.backing:
            url += '&track='+quote(self.backing)
        print("POSTING "+url)
        resp = await client.post(url)
        print("response: "+(await resp.read()).decode())
        if self.lyricTimings:
            metadata = resp.headers['x-audio-metadata']
            print("metadata is "+metadata)
            metadata = json.loads(metadata)
            clock = metadata['server_clock']
            sr = metadata['server_sample_rate']
            evs = ([ {'evid':i, 'clock':clock+t*sr} for i,t in enumerate(self.lyricTimings) ] +
                   [ {'evid': f'mute{i}', 'clock':clock+t*sr} for i,t in enumerate(self.muteTimings) ] +
                   [ {'evid': f'unmute{i}', 'clock':clock+t*sr} for i,t in enumerate(self.unmuteTimings) ] +
                   [ {'evid':-i, 'clock':clock+(self.lyricTimings[0]-i)*sr} for i in range(1,5) ])
            for i in count(0,10):
                # Break it up to avoid URL length limits
                chunk = evs[i:i+10]
                if not len(chunk):
                    break
                url = server + '/?event_data=' + quote(json.dumps(chunk))
                print("POSTING "+url)
                resp = await client.post(url)
                print("response: "+(await resp.read()).decode())
                
        
    def to_client(self, clientId, have):
        self.c_seen.add(clientId)
        self.consider_readiness()
        slotCounts = [0, 0, 0, 0]
        for slot in self.slots.values():
            slotCounts[slot] += 1
        return { 'widget': 'BucketSinging',
                 'lyrics': self.lyrics,
                 'boxColors': self.boxColors,
                 'server_url': BUCKET_SINGING_URL,
                 'ready': self.ready,
                 'slot': self.slots.get(clientId, 2),
                 'lyricLead': clientId in self.c_songLeader,
                 'background_opts': self.background_opts,
                 "videoUrl": self.videoUrl,
                 "roundVideo": self.roundVideo,
                 'justInit': self.justInit,
                 'slotCounts': slotCounts,
                 'dbginfo': '%d/%d/%d'%(len(self.c_ready),len(self.c_seen),len(self.c_expected)),
                 'startMuted': self.startMuted }

    @staticmethod
    async def preload(ritual, videoUrl=None, captions=None, **ignore):
        if videoUrl:
            ritual.videos[videoUrl] = captions

    def destroy(self):
        if hasattr(self,'sleeping_readiness_checker') and not self.sleeping_readiness_checker.done():
            self.sleeping_readiness_checker.cancel()

    def subpagesame(self, subhave, clientId):
        if self.ready:
            mysub = self.slots.get(clientId,2)
        else:
            mysub = -1
        return subhave == '%d' % mysub
