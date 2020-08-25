#!/usr/bin/env python

import argparse
from random import shuffle
from time import sleep
from glob import glob

import requests

parser = argparse.ArgumentParser(description='Send POSTS to test widgets.')
parser.add_argument('-u', metavar='URL', help='URL for the slide deck')
parser.add_argument('-n', metavar='namefile', nargs='?', help='Send names from the file')
parser.add_argument('-p', metavar='picturedir', nargs='?', help='Send images from the directory')
parser.add_argument('-c', metavar='count', nargs='?', type=int, help='Count to send')

args = parser.parse_args()
print(args)

if args.n:
    names = open(args.n).read().split('\n')
    shuffle(names)
    for i,name in enumerate(names):
        requests.post(args.u+'/widgetData', {'name':name})
        if args.c and i>args.c:
            break
        sleep(0.4)

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
        sleep(.5)
