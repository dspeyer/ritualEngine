from datetime import datetime, timezone

import aiohttp

from core import secrets


class Video(object):
    def __init__(self, ritual, videoUrl, boxColor, **ignore):
        self.ritual = ritual
        self.videoUrl = videoUrl
        self.boxColor = boxColor
        self.startTime = datetime.now()
        
    def to_client(self, clientId, have):
        return {
          'widget': 'Video', 
          'boxColor': self.boxColor,
          'videoUrl': self.videoUrl,
          'startedAgo': (datetime.now() - self.startTime).total_seconds()  
        }

    @staticmethod
    async def preload(ritual, videoUrl=None, captions=None, **ignore):
        if videoUrl:
            ritual.videos[videoUrl] = captions
