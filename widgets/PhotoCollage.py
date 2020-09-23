import cv2
import numpy as np
from random import random

CS=16

class PhotoCollage(object):
    def __init__(self, ritual, boxcolor, bigimage, saveas=None, **ignore):
        self.boxcolor = boxcolor
        self.saveto = {}
        if saveas:
            ritual.__dict__[saveas] = self.saveto
        self.gs = 16 # TODO: tweak
        self.map = np.zeros((self.gs,self.gs),'bool')
        self.ts = self.gs // 2
        self.imgs = []
        self.avg = 0
        self.ritual = ritual
        fn = 'examples/%s/%s' % (ritual.script, bigimage)
        raw = cv2.imread(fn)
        self.bigimage = cv2.resize(raw, dsize=(self.gs*CS,self.gs*CS))
        
    def to_client(self, have):
        return { 'widget': 'PhotoCollage',
                 'boxcolor': self.boxcolor,
                 'gridsize': self.gs,
                 'imgs': self.imgs }

    def sq_img_from_file(self, jpg):
        npjpg = np.asarray(bytearray(jpg), dtype="uint8")
        img = cv2.imdecode(npjpg, cv2.IMREAD_COLOR)
        (w,h,c) = img.shape
        mx = max(w,h)
        img2 = np.zeros((mx,mx,c),'uint8')
        img2[(mx-w)//2:(mx+w)//2, (mx-h)//2:(mx+h)//2, :] = img
        img3 = cv2.resize(img2, dsize=(CS,CS))
        self.avg *= len(self.imgs) / (len(self.imgs)+1)
        self.avg += img3.mean() / (len(self.imgs)+1)
        return img3, w/h
    
    def from_client(self, data, users):
        imgid = len(self.ritual.jpgs)
        print("Getting PhotoCollage Image Data")
        print(data)
        jpg = data['img'].file.read()
        self.ritual.jpgs.append(jpg)
        img, rat = self.sq_img_from_file(jpg)
        self.ritual.jpgrats.append(rat)
        self.saveto[','.join(users)] = imgid
        opts = self.get_opts() + self.get_opts_via_shrink()
        opts = self.clean(opts)
        if not opts:
            self.ts //= 2
            opts = self.get_opts_via_shrink()
            opts = self.clean(opts)
        self.dbg = np.zeros((self.gs*CS+len(opts)*(CS+2)+5,self.gs*CS,3),'uint8')
        dbgi = self.gs*CS + 2
        self.dbg[:,:,2]=129
        self.dbg[:self.gs*CS,:,:] = self.bigimage
        bestopt = None
        bestscore = float('inf')
        print("-----Placing--------")
        tb = self.bigimage.mean()
        for opt in opts:
            [x,y] = opt
            comp = self.bigimage[x*CS:(x+self.ts)*CS,y*CS:(y+self.ts)*CS]
            comp = cv2.resize(comp, (CS,CS))
            imgfc = np.clip(img, self.avg-tb, self.avg-tb+255) - self.avg + tb
            self.dbg[dbgi:dbgi+CS,1:1+CS,:] = img
            self.dbg[dbgi:dbgi+CS,CS+2:2*CS+2,:] = imgfc
            self.dbg[dbgi:dbgi+CS,2*CS+4:3*CS+4,:] = comp
            score = imgfc.astype('float32') - comp.astype('float32')
            score = np.abs(score)
            score = score.mean()
            cv2.putText(self.dbg,
                        '%d,%d %.2f nbf=%.2f'%(x,y,score,self.nbf(comp)),
                        (3*CS+6, dbgi+CS-4), # Order flipped because cv2
                        fontFace=cv2.FONT_HERSHEY_PLAIN,
                        fontScale=1,
                        color=(255,255,255))
            dbgi += CS+2
            print(x,',',y,': ',score)
            if score < bestscore:
                bestopt = opt
                bestscore = score
        [x,y] = bestopt
        print('picked ',x,',',y)
        print('---------------------')
        if self.map[x,y]:
            os = self.ts * 2
            tsx = (x//os)*os
            tsy = (y//os)*os
            print("looking to shrink image at ",tsx,tsy)
            for img in self.imgs:
                if img['x']==tsx and img['y']==tsy:
                    self.mark(value=False, **img)
                    img['size'] //= 2
                    if x==tsx and y==tsy:
                        img['x'] += img['size']
                        img['y'] += img['size']
                    self.mark(value=True, **img)
                    print(img)
                    break
            else:
                print("not found?")
        (b,g,r) = self.bigimage[x*CS:(x+self.ts)*CS,y*CS:(y+self.ts)*CS,:].mean(axis=(0,1))
        self.imgs.append( {'imgid':imgid,
                           'x':x, 'y':y, # Swap because np/cv2 does everything sideways
                           'r':r, 'g':g, 'b':b,
                           'size':self.ts,
                           'sm':random()/10+0.9, 'theta':random()*10-5 # Random parameters to avoid excess neatness
        } )
        self.mark(value=True, **self.imgs[-1])

    def mark(self,x,y,size,value,**ignore):
        self.map[x:x+size,y:y+size] = value
        
    def get_opts(self):
        opts = []
        for x in range(0,self.gs,self.ts):
            for y in range(0,self.gs,self.ts):
                if not self.map[x,y]:
                    opts.append([x,y])
        return opts

    def get_opts_via_shrink(self):
        opts = []
        for img in self.imgs:
            if img['size'] > self.ts:
                for dx in range(2):
                    for dy in range(2):
                        opts.append([img['x']+dx*self.ts, img['y']+dy*self.ts])
        return opts

    def nbf(self, img):
        img = img.mean(axis=2)
        img = img > 64
        frac = img.mean()
        return frac
    
    def clean(self, inopts):
        outopts = []
        for x,y in inopts:
            comp = self.bigimage[x*CS:(x+self.ts)*CS,y*CS:(y+self.ts)*CS]
            if self.nbf(comp) > 0.05:
                outopts.append([x,y])
        return outopts
    
    def get_dbg(self):
        return bytes(cv2.imencode('.PNG', self.dbg)[1])
