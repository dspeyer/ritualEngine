from core import secrets


class Livestream(object):
    def __init__(self, ritual, boxColor, **ignore):
        self.ritual = ritual
        self.boxColor = boxColor
        try:
            self.streamer_data = {
                'sdpURL': secrets['WOWZA_SDP_URL'],
                'applicationName': secrets['WOWZA_APPLICATION_NAME'],
                'streamName': secrets['WOWZA_STREAM_NAME'],
            }
            self.viewer_data = {
                'playbackUrl': secrets['WOWZA_PLAYBACK_URL'],
            }
        except KeyError:
            raise KeyError('livestream requires Wowza secrets')

    def to_client(self, clientId, have):
        if self.ritual.clients[clientId].isStreamer:
            return {
                'widget': 'Livestream',
                'boxColor': self.boxColor,
                **self.streamer_data,
            }
        else:
            return {
                'widget': 'Livestream',
                'boxColor': self.boxColor,
                **self.viewer_data,
            }
