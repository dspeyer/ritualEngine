class Youtube(object):
    def __init__(self, ritual, boxColor, videoId, **ignore):
        self.boxColor = boxColor
        self.videoId = videoId
    def from_client(self, data, users):
        pass
    def to_client(self, have):
        return { "widget": "Youtube",
                 "boxColor": self.boxColor,
                 "videoId": self.videoId }
