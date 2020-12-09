from datetime import datetime, timezone

import aiohttp

from core import secrets

try:
    wowza_auth_headers = {
        'wsc-api-key': secrets['WOWZA_API_KEY'],
        'wsc-access-key': secrets['WOWZA_ACCESS_KEY'],
    }
except KeyError:
    wowza_auth_headers = None


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

    # Very carelessly refactored out of rituals.py
    # Probably broken; don't care
    async def preload(self, ritual, name, **ignore):
        if not hasattr(ritual,'livestreams'):
            ritual.livestreams = {}
        session = aiohttp.ClientSession()
        if not wowza_auth_headers:
            raise KeyError('livestream requires Wowza secrets')
        async with session.post(
            'https://api.cloud.wowza.com/api/v1.6/live_streams',
            headers=wowza_auth_headers,
            json={
                'live_stream': {
                    'name': name + '_' + timestamp,
                    'transcoder_type': 'transcoded',
                    'billing_mode': 'pay_as_you_go',
                    'broadcast_location': 'us_west_california',
                    'encoder': 'other_webrtc',
                    'aspect_ratio_width': 1920,
                    'aspect_ratio_height': 1080,
                    'recording': True,
                },
            },
            ) as resp:
            resp.raise_for_status()
            livestream_json = await resp.json()
        livestream_data = livestream_json['live_stream']
        conn_info = livestream_data['source_connection_information']
        number, _ = path.splitext(filename)
        livestream = ritual.livestreams[int(number)] = struct(
            livestream_id=livestream_data['id'],
            playback_url=livestream_data['player_hls_playback_url'],
            source_connection_information={
                'sdpURL': conn_info['sdp_url'],
                'applicationName': conn_info['application_name'],
                'streamName': conn_info['stream_name'],
            },
        )
        async with session.put(
            f"https://api.cloud.wowza.com/api/v1.6/live_streams/{livestream.livestream_id}/start",
            headers=wowza_auth_headers,
            ) as resp:
            resp.raise_for_status()

        async def livestream_started(livestream_id):
            async with session.get(
                f"https://api.cloud.wowza.com/api/v1.6/live_streams/{livestream_id}/state",
                headers=wowza_auth_headers,
                ) as resp:
                resp.raise_for_status()
                livestream_json = await resp.json()
            state = livestream_json['live_stream']['state']
            if state == 'starting':
                return False
            elif state == 'started':
                return True
            else:
                raise OSError(f'illegal livestream state: {state}')
        for livestream in ritual.livestreams.values():
            while not await livestream_started(livestream.livestream_id):
                await asyncio.sleep(1)
