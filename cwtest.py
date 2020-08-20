#!/usr/bin/env python

import cv2
import numpy as np
from collections import defaultdict

inf = float('inf')

target = cv2.imread('cwmask3.png')[:,:,::-1]
print(target.shape)
(w,h,c) = target.shape
r = max(w,h)/100
target = cv2.resize(target, dsize=(int(w/r),int(h/r)))

outcolor = target * 0
wanted = target.astype('float32').mean(axis=2) / 255
table = (wanted.astype('int32')*0)

down = 0
right = 1
wanted = [ wanted, wanted.transpose() ]
table = [ table, table.transpose() ]
target = [ target, target.transpose((1,0,2)) ]
outcolor = [ outcolor, outcolor.transpose((1,0,2)) ]

letters = defaultdict(list)

f = open('friends.html','w')

f.write("""
<html><head><meta charset="UTF-8">
<style>
  td {
    transform: scale(1.35,1.02);
    transform-origin: top left;
    font-weight: bold;
    font-size: 10pt;
    color: white;
    font-family: monospace;
    line-height: 1;
    text-align: center;
  }
  table {
    border-spacing: 0;
  }
  body {
    background: black;
  }
</style>
</head>
<body>
<table>
""")

def calc_score(sx,sy,ori,name):
    ey = sy + name.shape[0]
    # print('  ',sx,sy,ey,(ori and 'right' or 'down'))
    if sx < 1:
        # print('    too left')
        return -inf
    if sx > table[ori].shape[0] - 2:
        # print('    too right')
        return -inf
    if sy < 1:
        # print('    too up')
        return -inf
    if ey > table[ori].shape[1] - 1:
        # print('    too down')
        return -inf
    if table[ori][sx,sy-1] or table[ori][sx,ey]:
        # print('    touching head/tail')
        return -inf
    comp = table[ori][sx-1:sx+2,sy:ey].copy()
    if np.any( (comp[0,:]+comp[2,:])*(comp[1,:]==0) ):
        # print('    touching side') 
        return -inf
    if np.any( comp[1,:] * (comp[1,:]!=name) ):
        # print('    mismatch',comp[1,:],name)
        return -inf
    return wanted[ori][sx,sy:ey].sum() - (table[ori][sx-2:sx+3,sy-2:ey+3]!=0).sum()/2

def place(sx,sy,ori,name):
    ey = sy + name.shape[0]
    table[ori][sx,sy:ey] = name
    for i,l in enumerate(name):
        if ori==down:
            letters[l].append((sx,sy+i))
        else:
            letters[l].append((sy+i,sx))
    c2m = target[ori][sx-1:sx+2,sy-1:ey+1]
    color = c2m.mean(axis=(0,1)) / 4
    rc = (np.random.random(3)*32).astype('uint8')+32
    outcolor[ori][sx,sy:ey] = color + rc

for n,rawname in enumerate(open('friends.txt')):
    if n>100:
        break
    rawname = rawname.strip()
    name = [ ord(c) for c in rawname ]
    name = np.array(name)
    best = (-1, -1, down, -inf)
    for i,l in enumerate(name):
        if l==32:
            continue
        for ix,iy in letters[l]:
            for ori in [down,right]:
                if ori == right:
                    (ix,iy) = (iy,ix)
                sx = ix
                sy = iy - i
                score = calc_score(sx,sy,ori,name)
                if score > best[3]:
                    best = (sx,sy,ori,score)
    if best[0]!=-1:
        print("Placed %s crossing"%rawname)
        place(*best[:3],name)
        continue
    for sx in range(wanted[down].shape[0]):
        for sy in range(wanted[down].shape[1]):
            score = calc_score(sx,sy,down,name)
            if score > best[3]:
                best = (sx,sy,down,score)
            score = calc_score(sy,sx,right,name)
            if score > best[3]:
                best = (sy,sx,right,score)


    if best[0]!=-1:
        print("Placed %s alone %s"%(rawname,best))
        place(*best[:3],name)
        continue
    print("Could not place %s"%rawname)

for j in range(table[down].shape[1]):
    f.write('<tr>')
    for i in range(table[down].shape[0]):
        if table[down][i,j]:
            color = tuple(outcolor[down][i,j])
            char = chr(table[down][i,j])
            f.write('<td style="background:rgb(%d,%d,%d);">%s</td>'%(color+(char,)))
        else:
            f.write('<td></td>')
    f.write('</tr>')
f.write('</table></body></html>')

    
f.close()
    
print('\n'.join([''.join([c and chr(c) or ' ' for c in row]) for row in table[down]]))
