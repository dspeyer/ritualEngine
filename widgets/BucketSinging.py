import sys
import os
import socket
import asyncio
from asyncio.subprocess import PIPE, STDOUT, DEVNULL

from aiohttp import web

BUCKET_PATH = os.environ.get('BUCKET_PATH','../solstice-audio-test')
PORT_FORWARD_TEMPLATE = os.environ.get('PORT_FORWARD_TEMPLATE', '/%d')
MIN_PORT = int(os.environ.get('MIN_PORT','8081'))
MAX_PORT = int(os.environ.get('MIN_PORT','8083'))

async def launchBBS(ritual):
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
    proc = await asyncio.create_subprocess_exec(os.path.join(BUCKET_PATH,'server.py'), '%d'%port,
                                                stdin=DEVNULL, stdout=PIPE, stderr=STDOUT,
                                                env={'PYTHONUNBUFFERED': '1'})
    print("Subserver on pid %d" % proc.pid)
    asyncio.create_task(copyStdout(proc, port))
    ritual.bs_proc = proc
    ritual.bs_port = port
    
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
    def __init__(self, ritual, boxColor, lyrics, last_song=False, bsBkg=None, **ignore):
        self.ritual = ritual
        self.boxColor = boxColor
        self.lyrics = lyrics
        self.client_ids = []
        self.own_server = last_song
        self.background_opts = (bsBkg or {})
            
    async def async_init(self):
        if not hasattr(self.ritual, 'bs_proc'):
            await launchBBS(self.ritual)

    @staticmethod
    def piece(req):
        fn = req.match_info.get('fn')
        content = open(os.path.join(BUCKET_PATH,'html',fn), 'rb').read()
        return web.Response(body=content, content_type='text/javascript')

    def from_client(self, data, users):
        print("got registration of %d"%int(data['client_id']))
        self.client_ids.append(int(data['client_id']))

    def to_client(self, have):
        return { 'widget': 'BucketSinging',
                 'lyrics': self.lyrics,
                 'boxColor': self.boxColor,
                 'server_url': PORT_FORWARD_TEMPLATE % self.ritual.bs_port,
                 'client_ids': self.client_ids,
                 'cleanup': self.own_server,
                 'background_opts': self.background_opts}

    def destroy(self):
        if self.own_server:
            self.ritual.bs_proc.terminate()
            del self.ritual.bs_proc
            del self.ritual.bs_port

    def subpagesame(self, subhave):
        return subhave == 'ready'
        
