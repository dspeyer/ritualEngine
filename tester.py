#!/usr/bin/env python

import argparse
from random import shuffle, random, choice
from time import sleep
from glob import glob
import re

import requests

parser = argparse.ArgumentParser(description='Send POSTS to test widgets.')
parser.add_argument('-u', metavar='URL', help='URL for the slide deck')
parser.add_argument('-n', metavar='namefile', nargs='?', help='Send names from the file')
parser.add_argument('-p', metavar='picturedir', nargs='?', help='Send images from the directory')
parser.add_argument('-a', metavar='avatardir', nargs='?', help='Send avatar images from the directory')
parser.add_argument('-z', metavar='avatardir', nargs='?', help='Send client avatar images from the directory')
parser.add_argument('-c', metavar='count', nargs='?', type=int, help='Count to send')
parser.add_argument('-s', metavar='sleeptime', type=float, default=0.5, help='Sleep between uploads')

args = parser.parse_args()
print(args)

if args.n:
    names = open(args.n).read().split('\n')
    shuffle(names)
    for i,name in enumerate(names):
        requests.post(args.u+'/widgetData', {'name':name})
        if args.c and i>args.c:
            break
        sleep(args.s)

if args.p:
    fns = glob(args.p+'/*.jpg')
    shuffle(fns)
    for i,fn in enumerate(fns):
        print("sending '%s'"%fn)
        jpg = open(fn,'rb').read()
        files = { 'img': ('blob', jpg, 'image/jpeg') }
        requests.post(args.u+'/widgetData', files=files)
        if args.c and i >= args.c-1:
            break
        sleep(args.s)

if args.a:
    fns = glob(args.a+'/*.jpg')
    shuffle(fns)
    for i,fn in enumerate(fns):
        print("sending '%s'"%fn)
        jpg = open(fn,'rb').read()
        files = { 'photofile': ('blob', jpg, 'image/jpeg') }
        data = {
            'email': '%f@mailinator.com'%(random()),
            'name': choice(['Alice','Bob','Carol','Eve'])+' '+fn.split('/')[-1].split('_')[0],
            'zoom': 0,
            'x': 0,
            'y': 0,
            'photosource': 'file'
        }
        requests.post(args.u+'/partake', data=data, files=files)
        if args.c and i >= args.c-1:
            break
        sleep(args.s)


if args.z:
    fns = glob(args.z+'/*.jpg')
    shuffle(fns)
    for i,fn in enumerate(fns):
        client = requests.get(args.u+'/partake').text
        for line in client.split('\n'):
            m = re.match(" *let clientId = '(.*)';", line)
            if m:
                clientId = m.group(1)
        print("sending '%s'"%fn)
        jpg = open(fn,'rb').read()
        files = { 'img': ('blob', jpg, 'image/jpeg') }
        requests.post(args.u+'/clientAvatar/'+clientId, files=files)
        if args.c and i >= args.c-1:
            break
        sleep(args.s)
