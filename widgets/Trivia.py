from random import random
from colorsys import hsv_to_rgb

# Character widths are from Liberation Serif
# Actual display font may vary
cws = {
  " ": 0.32,
  "!": 0.43,
  '"': 0.52,
  "#": 0.64,
  "$": 0.64,
  "%": 1.07,
  "&": 1.00,
  "'": 0.23,
  "(": 0.43,
  ")": 0.43,
  "*": 0.64,
  "+": 0.73,
  ",": 0.32,
  "-": 0.43,
  ".": 0.32,
  "/": 0.36,
  "0": 0.64,
  "1": 0.64,
  "2": 0.64,
  "3": 0.64,
  "4": 0.64,
  "5": 0.64,
  "6": 0.64,
  "7": 0.64,
  "8": 0.64,
  "9": 0.64,
  ":": 0.36,
  ";": 0.36,
  "<": 0.73,
  "=": 0.73,
  ">": 0.73,
  "?": 0.57,
  "@": 1.18,
  "A": 0.93,
  "B": 0.86,
  "C": 0.86,
  "D": 0.93,
  "E": 0.79,
  "F": 0.72,
  "G": 0.93,
  "H": 0.93,
  "I": 0.43,
  "J": 0.50,
  "K": 0.93,
  "L": 0.79,
  "M": 1.14,
  "N": 0.93,
  "O": 0.93,
  "P": 0.72,
  "Q": 0.93,
  "R": 0.86,
  "S": 0.72,
  "T": 0.79,
  "U": 0.93,
  "V": 0.93,
  "W": 1.21,
  "X": 0.93,
  "Y": 0.93,
  "Z": 0.79,
  "[": 0.43,
  "\\": 0.36,
  "]": 0.43,
  "^": 0.60,
  "_": 0.64,
  "`": 0.43,
  "a": 0.57,
  "b": 0.64,
  "c": 0.57,
  "d": 0.64,
  "e": 0.57,
  "f": 0.43,
  "g": 0.64,
  "h": 0.64,
  "i": 0.36,
  "j": 0.36,
  "k": 0.64,
  "l": 0.36,
  "m": 1.00,
  "n": 0.64,
  "o": 0.64,
  "p": 0.64,
  "q": 0.64,
  "r": 0.43,
  "s": 0.50,
  "t": 0.36,
  "u": 0.64,
  "v": 0.64,
  "w": 0.93,
  "x": 0.64,
  "y": 0.64,
  "z": 0.57,
  "{": 0.62,
  "|": 0.26,
  "}": 0.62,
  "~": 0.70
}

def intt(x):
    return tuple((int(i) for i in x))

class Trivia(object):
    def __init__(self, ritual, boxColors, saveas=None, **ignore):
        self.ritual = ritual
        self.boxColors = boxColors
        self.data = []
        if saveas:
            self.saveto = ritual.__dict__[saveas] = []

    def from_client(self, data, users):
        txt = data['txt']
        if hasattr(self,'saveto'):
            self.saveto.append(txt)
        tw = sum([ cws.get(c, 1) for c in txt ])
        lines = max(int(tw / 20) + int(random()*2), 1)
        w = tw / lines
        w *= 1.1 # safety margin
        x = random()
        y = random() * 0.8
        rgb = hsv_to_rgb(random(), 1, 128)
        print(rgb)
        print(type(rgb))
        color = '#%02x%02x%02x' % intt(rgb)
        self.data.append({'t':txt, 'w':'%.1fem'%w, 'x': x, 'y': y, 'color': color})
        print(self.data)
            
    def to_client(self, have):
        return {
            "widget": "Trivia",
            "boxColors": self.boxColors,
            "data": self.data
        }
