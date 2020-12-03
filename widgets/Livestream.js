/* Based on https://github.com/WowzaMediaSystems/webrtc-examples

Copyright (c) 2020, Wowza Media Systems, LLC. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following
conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived
from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT
NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import WowzaWebRTCPublish from 'https://cdn.jsdelivr.net/gh/WowzaMediaSystems/webrtc-examples@5e20a7474dfc0dbec0386f6f2ec76587bfc30b58/src/jquery-example/lib/WowzaWebRTCPublish.js';

export class Livestream {
    constructor({playerId, playerEmbedCode, sdpURL, applicationName, streamName}) {
        if (playerEmbedCode) {
            this.publishing = false;
            this.element = $(
                "<div id='wowza_player'></div>",
                $("<script id='player_embed'></script>").attr('src', `https://player.cloud.wowza.com/hosted/${player_id}/wowza.js`)).appendTo(document.body);
            // this.element = $(playerEmbedCode).appendTo(document.body);
        } else {
            this.publishing = true;
            this.element = $('<video autoplay playsinline muted></video>').appendTo(document.body);
            WowzaWebRTCPublish.on({
                onStateChanged(newState) {
                    console.log('WowzaWebRTCPublish.onStateChanged', newState);
                },
                onError(error) {
                    throw error;
                },
            });
            WowzaWebRTCPublish.set({
                videoElementPublish: this.element[0],
                sdpURL,
                applicationName,
                streamName,
                settings: {
                    audioBitrate: '64',
                    audioCodec: 'opus',
                    videoBitrate: '3500',
                    videoCodec: '42e01f',
                    videoFrameRate: '30',
                    frameSize: 'default',
                },
            }).then(() => {
                WowzaWebRTCPublish.start();
            });
        }
    }

    async from_server() {}
    
    destroy() {
        if (this.publishing) {
            WowzaWebRTCPublish.stop();
        }
        this.element.remove();
    }
}
