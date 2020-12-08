from datetime import datetime, timezone

import aiohttp

from core import secrets


class Video(object):
    def __init__(self, ritual, videoUrl, boxColor, **ignore):
        self.ritual = ritual
        self.videoUrl = videoUrl
        self.boxColor = boxColor

    def to_client(self, clientId, have):
        return {
          'widget': 'Video', 
          'boxColor': self.boxColor,
          'videoUrl': self.videoUrl
        }
