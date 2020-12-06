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
PORT_FORWARD_TEMPLATE = os.environ.get('PORT_FORWARD_TEMPLATE', '/%d')
MIN_PORT = int(os.environ.get('MIN_PORT','8081'))
MAX_PORT = int(os.environ.get('MIN_PORT','8081'))

mark_base = 1000;

async def launchBBS():
    for port in range(MIN_PORT, MAX_PORT+1):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(('localhost',port))
            sock.close()
            break
        except OSError:
            continue
    else:
        raise ValueError('Out of ports')
    print("Starting subserver on port %d"%port)
    env = copy(os.environ)
    env['PYTHONUNBUFFERED'] = '1'
    if 'VIRTUAL_ENV' in env:
        cmd = ['/usr/bin/env', 'python']
    else:
        cmd = ['/usr/bin/python3']
    cmd += [os.path.join(BUCKET_PATH,'server_wrapper.py'), '%d'%port]
    kwargs = {'stdin':DEVNULL, 'stdout':PIPE, 'stderr':STDOUT, 'env':env}
    proc = await asyncio.create_subprocess_exec(*cmd, **kwargs)
                                                
    print("Subserver on pid %d" % proc.pid)
    asyncio.create_task(copyStdout(proc, port))
    return (proc, port)
    
async def copyStdout(proc,port):
    cnt=0
    while True:
        s = await proc.stdout.readline()
        s = s.decode('utf-8').rstrip()
        for l in s.split('\n'):
            print("[BBSS %d] %s" % (port,l))
        if proc.returncode is not None or proc.stdout.at_eof():
            print("BBSS %d terminated")
            return
        os.kill(proc.pid, 0) # Because the above doesn't always seem to work


class BucketSinging(object):
    def __init__(self, boxColor, lyrics, last_song=False, bsBkg=None, leader=None, backing=None, videoUrl=None, justInit=False, **ignore):
        self.boxColor = boxColor
        self.lyrics = lyrics
        self.client_ids = []
        self.own_server = last_song
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
                 'lyrics': self.lyrics,
                 'boxColor': self.boxColor,
                 'background_opts': self.background_opts,
                 'videoUrl': self.videoUrl,
                 'mark_base': self.mark_base,
                 'leader': self.leader,
                 'backing_track': self.backing or False,
                 'justInit': self.justInit}

    def destroy(self):
        if self.own_server:
            self.ritual.bs_proc.terminate()
            del self.ritual.bs_proc
            del self.ritual.bs_port

        
