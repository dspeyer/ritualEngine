from datetime import datetime,timedelta

class WelcomeWatch(object):
    def __init__(self, ritual, boxColor, **ignore):
        self.ritual = ritual
        self.boxColor = boxColor

    def from_client(self, data, users):
        pass

    def to_client(self, clientId, have):
        thresh = datetime.now() - timedelta(seconds=30)
        return { 'widget': 'WelcomeWatch',
                 'boxColor': self.boxColor,
                 'n': len([c for c in self.ritual.clients.values() if c.lastSeen>thresh and not c.welcomed]) }
        
