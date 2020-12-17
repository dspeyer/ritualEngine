class AvatarTester(object):
    def __init__(self, ritual, boxColor, **ignore):
        self.ritual = ritual
        self.boxColor = boxColor

    def to_client(self, clientId, have):
        return { 'widget': 'AvatarTester',
                 'boxColor': self.boxColor }

    def from_client(self, data, users):
        pass
