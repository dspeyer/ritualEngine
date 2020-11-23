from random import shuffle

class CircleFlames(object):
    def __init__(self, ritual, victims, flames, **ignore):
        self.ritual = ritual
        self.victims = sum( [ ritual.__dict__[v] for v in victims ], [])
        self.flames = list(ritual.__dict__[flames].values())
        shuffle(self.victims)
        shuffle(self.flames)
        
    def from_client(self, data, users):
        self.ritual.state = None
        self.ritual.page += 1
        
    def to_client(self, clientId, have):
        return {
            "widget": "CircleFlames",
            "victims": self.victims,
            "flames": self.flames
        }
