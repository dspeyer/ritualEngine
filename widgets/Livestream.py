from datetime import datetime, timezone

import aiohttp

from core import secrets


class Livestream(object):
    def __init__(self, ritual, page, name, boxColor, **ignore):
        self.ritual = ritual
        self.wowza_data = ritual.livestreams[page]
        self.name = name
        self.boxColor = boxColor

    def to_client(self, clientId, have):
        common_data = {'widget': 'Livestream', 'boxColor': self.boxColor}
        if self.ritual.clients[clientId].isStreamer:
            return {**common_data, **self.wowza_data.source_connection_information}
        else:
            return {**common_data, 'playbackUrl': self.wowza_data.playback_url}
