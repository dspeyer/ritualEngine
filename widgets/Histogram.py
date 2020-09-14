from collections import defaultdict
import numpy as np

class Histogram(object):
    def __init__(self, ritual, boxColors, images, saveas, initRange=None, **ignore):
        self.ritual = ritual
        self.boxColors = boxColors
        self.imageIds = ritual.__dict__.get(images,{})
        if saveas not in self.ritual.__dict__:
            self.ritual.__dict__[saveas] = []
        self.data = self.ritual.__dict__[saveas]
        if initRange:
            self.x0 = initRange[0]
            self.w = initRange[1] - initRange[0]
        elif self.data:
            self.x0 = min([ i['x'] for i in self.data ])
            self.w = max([ i['x'] for i in self.data ]) - self.x0 + 1
        else:
            # Should never happen
            self.x0 = 42
            self.w = 42

    def from_client(self, data, user):
        x = int(data.get('x'))
        imgId = self.imageIds.get(user) or 0
        self.data.append({'x':x,'imgId':imgId})
        if x < self.x0:
            d = self.x0 - x
            self.x0 -= d
            self.w += d
        elif x >= self.x0 + self.w:
            self.w = (x - self.x0) + 1
        if hasattr(self.ritual,'participants') and user==self.ritual.participants[0]:
            self.ritual.rotateSpeakers();

            
    def to_client(self, have):
        WF = 15
        wi = int(np.ceil(self.w / WF))
        y = np.zeros(self.w+wi, 'float32')
        outimgs = []
        for i in self.data:
            imgId = i['imgId']
            x = (i['x']-self.x0)
            w = 100 / WF
            h = w * self.ritual.jpgrats[imgId]
            print(x,wi,x+wi)
            base = y[x:x+wi].max()
            y[x:x+wi] = base + h
            print(x,(x+wi),base)
            xm = x * 100 / (self.w+wi)
            outimgs.append({'imgId':imgId, 'x':xm, 'y':float(base), 'w':w, 'h':h})
        dx = self.w / 10
        dxexp = 10 ** int(np.log(dx)/np.log(10))
        dxm = dx / dxexp
        if dxm < 1.4:
            dxm = 1
        elif dxm < 2.5:
            dxm = 2
        else:
            dxm = 5
        dx = dxm * dxexp
        axs = int(np.ceil(self.x0/dx)*dx)
        xaxv = range(axs, self.x0+self.w, dx)
        xax = [ {"x":(v+wi/2-self.x0) * 100 / (self.w+wi), "v":v}
                for v in xaxv ]
        return {
            "widget": "Histogram",
            "boxColors": self.boxColors,
            "imgs": outimgs,
            "xaxes": xax
        }

    def subpagesame(self, subhave):
        return int(subhave) == len(self.data)
