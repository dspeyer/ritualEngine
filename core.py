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

# TODO: real templating system?
def tpl(fn, **kwargs):
    s = open(fn).read()
    for k,v in kwargs.items():
        s = s.replace('%'+k+'%', v)
    return s

app = web.Application()

