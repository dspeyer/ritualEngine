from datetime import datetime, timezone

import aiohttp

from core import random_token, secrets


class Livestream(object):
    def __init__(self, ritual, name, **ignore):
        self.ritual = ritual
        self.name = name
        try:
            self.auth_headers = {
                'wsc-api-key': secrets['WOWZA_API_KEY'],
                'wsc-access-key': secrets['WOWZA_ACCESS_KEY'],
            }
        except KeyError:
            raise KeyError('livestream requires Wowza secrets')

    async def async_init(self):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'https://api.cloud.wowza.com/api/v1.6/live_streams',
                headers=self.auth_headers,
                json={
                    'live_stream': {
                        'name': self.name + '_' + datetime.now(timezone.utc).isoformat(),
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
                print(await resp.json())
                resp.raise_for_status()
                livestream_data = (await resp.json())['live_stream']
            self.player_id = livestream_data['player_id']
            conn_info = livestream_data['source_connection_information']
            self.source_connection_information = {
                'sdpURL': conn_info['sdp_url'],
                'applicationName': conn_info['application_name'],
                'streamName': conn_info['stream_name'],
            }
            async with session.put(
                f"https://api.cloud.wowza.com/api/v1.6/live_streams/{livestream_data['id']}/start",
                headers=self.auth_headers,
                ) as resp:
                resp.raise_for_status()
            # async with session.get(
            #     f"https://api.cloud.wowza.com/api/v1.6/players/{livestream_data['player_id']}",
            #     headers=self.auth_headers,
            #     ) as resp:
            #     resp.raise_for_status()
            #     self.player_embed_code = (await resp.json())['player']['embed_code']

    def to_client(self, clientId, have):
        if self.ritual.clients[clientId].isStreamer:
            return {
                'widget': 'Livestream',
                **self.source_connection_information,
            }
        else:
            return {
                'widget': 'Livestream',
                'playerId': self.player_id,
                # 'playerEmbedCode': self.player_embed_code,
            }
