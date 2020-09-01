import sys
import os
from itertools import count
import socket
import asyncio
from asyncio.subprocess import PIPE, STDOUT, DEVNULL

from aiohttp import web

BUCKET_PATH = os.environ.get('BUCKET_PATH','../solstice-audio-test')
PORT_FORWARD_TEMPLATE = os.environ.get('PORT_FORWARD_TEMPLATE', '/%d')

class BucketSinging(object):
    def __init__(self, ritual, boxColor, lyrics, **ignore):
        self.boxColor = boxColor
        self.lyrics = lyrics
        for port in count(8081):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind(('localhost',port))
                sock.close()
                break
            except OSError:
                continue
        self.port = port
        self.client_ids = []

    async def async_init(self):
        print("Starting subserver on port %d"%self.port)
        self.proc = await asyncio.create_subprocess_exec(os.path.join(BUCKET_PATH,'server.py'), '%d'%self.port,
                                                         stdin=DEVNULL, stdout=PIPE, stderr=STDOUT,
                                                         env={'PYTHONUNBUFFERED': '1'})
        print("Subserver on pid %d" % self.proc.pid)
        asyncio.create_task(self.copyStdout())

    async def copyStdout(self):
        cnt=0
        while True:
            s = await self.proc.stdout.readline()
            s = s.decode('utf-8').rstrip()
            for l in s.split('\n'):
                print("[BBSS %d] %s" % (self.port,l))
            if self.proc.returncode is not None or self.proc.stdout.at_eof():
                print("BBSS %d terminated")
                return
            os.kill(self.proc.pid, 0) # Because the above doesn't always seem to work

    @staticmethod
    def piece(req):
        fn = req.match_info.get('fn')
        content = open(os.path.join(BUCKET_PATH,'html',fn), 'rb').read()
        return web.Response(body=content, content_type='text/javascript')

    def from_client(self, data, ip):
        print("got registration of %d"%int(data['client_id']))
        self.client_ids.append(int(data['client_id']))

    def to_client(self, have):
        return { 'widget': 'BucketSinging',
                 'lyrics': self.lyrics,
                 'boxColor': self.boxColor,
                 'server_url': PORT_FORWARD_TEMPLATE % self.port,
                 'client_ids': self.client_ids }

    def destroy(self):
        self.proc.terminate()

    def subpagesame(self, subhave):
        return subhave == 'ready'
        
