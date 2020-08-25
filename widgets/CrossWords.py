import cv2
import numpy as np
from collections import defaultdict

inf = float('inf')
down = 0
right = 1

class CrossWords(object):

    def __init__(self, ritual, boxColors, image, size, **ignore):
        self.boxColors = boxColors

        target = cv2.imread('examples/%s/%s'%(ritual.script,image))[:,:,::-1]
        (w,h,c) = target.shape
        r = max(w,h) / size
        target = cv2.resize(target, dsize=(int(w/r),int(h/r)))

        outcolor = target * 0
        wanted = target.astype('float32').mean(axis=2) / 255
        table = (wanted.astype('int32')*0)

        self.wanted = [ wanted, wanted.transpose() ]
        self.table = [ table, table.transpose() ]
        self.target = [ target, target.transpose((1,0,2)) ]
        self.outcolor = [ outcolor, outcolor.transpose((1,0,2)) ]

        self.letters = defaultdict(list)

    def from_client(self, data, ip):
        rawname = data['name']
        name = [ ord(c) for c in rawname ]
        name = np.array(name)
        best = (-1, -1, down, -inf)
        for i,l in enumerate(name):
            if l==32:
                continue
            for ix,iy in self.letters[l]:
                for ori in [down,right]:
                    if ori == right:
                        (ix,iy) = (iy,ix)
                    sx = ix
                    sy = iy - i
                    score = self.calc_score(sx,sy,ori,name)
                    if score > best[3]:
                        best = (sx,sy,ori,score)
        if best[0]!=-1:
            print("Placed %s crossing"%rawname)
            self.place(*best[:3],name)
            return
        for sx in range(self.wanted[down].shape[0]):
            for sy in range(self.wanted[down].shape[1]):
                score = self.calc_score(sx,sy,down,name)
                if score > best[3]:
                    best = (sx,sy,down,score)
                score = self.calc_score(sy,sx,right,name)
                if score > best[3]:
                    best = (sy,sx,right,score)
        if best[0]!=-1:
            print("Placed %s alone %s"%(rawname,best))
            self.place(*best[:3],name)
            return
        print("Could not place %s"%rawname)

    def calc_score(self,sx,sy,ori,name):
        ey = sy + name.shape[0]
        if sx < 1:
            # print('    too left')
            return -inf
        if sx > self.table[ori].shape[0] - 2:
            # print('    too right')
            return -inf
        if sy < 1:
            # print('    too up')
            return -inf
        if ey > self.table[ori].shape[1] - 1:
            # print('    too down')
            return -inf
        if self.table[ori][sx,sy-1] or self.table[ori][sx,ey]:
            # print('    touching head/tail')
            return -inf
        comp = self.table[ori][sx-1:sx+2,sy:ey].copy()
        if np.any( (comp[0,:]+comp[2,:])*(comp[1,:]==0) ):
            # print('    touching side') 
            return -inf
        if np.any( comp[1,:] * (comp[1,:]!=name) ):
            # print('    mismatch',comp[1,:],name)
            return -inf
        c0 = lambda x: (x>=0) and x or 0
        wanted_spot = self.wanted[ori][sx,sy:ey].sum()
        already_covered = (self.table[ori][c0(sx-2):sx+3,c0(sy-2):ey+3]!=0).sum()
        vicinity = (self.table[ori][c0(sx-5):sx+6,c0(sy-5):ey+6]!=0).sum()
        return wanted_spot - 0.5*already_covered - 0.2*vicinity
        
    def place(self,sx,sy,ori,name):
        ey = sy + name.shape[0]
        self.table[ori][sx,sy:ey] = name
        for i,l in enumerate(name):
            if ori==down:
                self.letters[l].append((sx,sy+i))
            else:
                self.letters[l].append((sy+i,sx))
        c2m = self.target[ori][sx-1:sx+2,sy-1:ey+1]
        color = c2m.mean(axis=(0,1)) / 2
        rc = (np.random.random(3)*32).astype('uint8')
        self.outcolor[ori][sx,sy:ey] = color + rc + 95

    def to_client(self, have):
        data = []
        for i in range(self.table[right].shape[0]):
            data.append([])
            for j in range(self.table[right].shape[1]):
                data[i].append({})
                data[i][j]['t'] = chr(self.table[right][i,j] or 32)
                data[i][j]['c'] = '#%02x%02x%02x' % tuple(self.outcolor[right][i,j])
        return {
            "widget": "CrossWords",
            "data": data,
            "boxColors": self.boxColors
        }
