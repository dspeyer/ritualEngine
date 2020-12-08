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
    def __init__(self, boxColor, lyrics, bsBkg=None, leader=None, backing=None, videoUrl=None, justInit=False, **ignore):
        self.boxColor = boxColor
        self.lyrics = lyrics
        self.client_ids = []
        self.background_opts = (bsBkg or {})
        self.videoUrl = videoUrl
        self.backing = backing
        self.justInit = justInit
        
        leader = getUserByEmail(leader)
        if leader:
            self.leader = leader.rid
        else:
            self.leader = None
        global mark_base
        self.mark_base = mark_base
        mark_base += 1000

    @staticmethod
    def piece(req):
        fn = req.match_info.get('fn')
        content = open(os.path.join(BUCKET_PATH,'html',fn), 'rb').read()
        return web.Response(body=content, content_type='text/javascript')

    def to_client(self, clientId, have):
        return { 'widget': 'BucketSinging',
                 'serverUrl': PORT_FORWARD_PATH,
                 'lyrics': self.lyrics,
                 'boxColor': self.boxColor,
                 'background_opts': self.background_opts,
                 'videoUrl': self.videoUrl,
                 'mark_base': self.mark_base,
                 'leader': self.leader,
                 'backing_track': self.backing or False,
                 'justInit': self.justInit}


        
