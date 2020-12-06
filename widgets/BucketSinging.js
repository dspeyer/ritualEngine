import {MicEnumerator, openMic, BucketBrigadeContext, SingerClient, VolumeCalibrator, LatencyCalibrator} from './BucketSinging/app.js';
import { putOnBox, bkgSet, bkgZoom } from '../../lib.js';

window.reportedVolume = {}; // app.js writes to reportedVolume.innerText for legacy reasons

let acknowledgeMic;
let micAcknowledgedPromise = new Promise((res) => {
  acknowledgeMic = res;
});
let context = null;
let client = null;
let estimator = null;
let calibrationSuccess;
let cssInit = false;
let css = `
  div { 
    color: white;
  }
  div.lyrics {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow-y: auto;
    text-shadow: 1px 1px 2px #777, -1px -1px 2px #777, 1px -1px 2px #777, -1px 1px 2px #777;
  }
  div.lyrics span {
    font-size: 16pt;
    text-align: center;
    white-space: pre;
  }
  div.lyrics span.current {
    font-weight: bold;
    color: yellow;
    text-shadow: 1px 1px 4px black, -1px -1px 4px black, 1px -1px 4px black, -1px 1px 4px black;
    font-size: 17pt;
  }
  div.lyrics span.old {
    color: #999;
    text-shadow: 1px 1px 2px #444, -1px -1px 2px #444;
  } 
`;

let contextReadyPromise = micAcknowledgedPromise.then(async () => {
  let mics = await (new MicEnumerator()).mics();
  let mic = mics[0]; // TODO: be smarter?
  console.log('Chose mic: ',mic);
  let micStream = await openMic(mic.deviceId);
  context = new BucketBrigadeContext({micStream});
  await context.start_bucket();
});

async function initClient() {
  let div = $('<div id="calibrator-popup">').css({background:'rgba(0.5, 0.5, 0.5, 1)',
                            fontSize: '14pt',
                            textShadow: '0 0 1px black',
                            paddingLeft: 16,
                            paddingRight: 16,
                            position: 'absolute',
                            top: '20vh',
                            height: '16em',
                            left: '15vw',
                            right: '300px',
                            border: '2px outset #777'})
                      .appendTo($('body'));
  div.append("<p>First we'll measure the <b>latency</b> of your audio hardware.</p><p>Please turn your volume to max and put your "+
             "headphones where your microphone can hear them. (On Macbooks this is near the escape key) Or get ready to tap your microphone in time to the beeps.</p>");
  div.append($('<br>'));
  let button = $('<input type=button class="medium-button">').attr('value',"I'm ready: Start the LOUD beeping!").appendTo(div);
  await new Promise((res)=>{button.on('click',res);});
  
  div.empty();
  div.append("<p>Beeping... (hold your speakers near mic [near escape key for macbooks] if it's not registering)</p>");
  div.append('Beeps heard: ');
  let heard = $('<span>').appendTo(div);
  div.append($('<br><br>'));
  button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.").appendTo(div);
  div.append(button);
  calibrationSuccess = await new Promise((res) => {
    estimator = new LatencyCalibrator({context, clickVolume:100}); // TODO: gradually increasing clickVolume
    estimator.addEventListener('beep', (ev)=>{
      console.log(ev);
      if (ev.detail.done) {
        estimator = null;
        res(true);
      }
      heard.text(ev.detail.samples);
    });
    button.on('click', (ev)=>{ estimator.close(); estimator = null; res(false); });
  });
  calibrationSuccess = calibrationSuccess && await new Promise(async (res) => {
    div.empty();
    div.append($("<p>Now we need to calibrate your <b>volume</b>.  Please sing at the same volume you plan to during "+
                "the event. For your convenience, here are some lyrics:" +
                "<blockquote><i>" +
                "Mary had a little iamb, little iamb, little iamb<br/>" +
                "And everywhere that Mary went trochies were sure to come" +
                "</i></blockquote></p>"));
    button = $('<input type=button>').attr('value',"I'm singing").appendTo(div);  
    await new Promise((res)=>{button.on('click',res);});
    button.remove();
    div.append($("<p><i>We're listening...</i></p>"));
    button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.").appendTo(div);
    div.append(button);
    estimator = new VolumeCalibrator({context});
    estimator.addEventListener('volumeCalibrated', () => {
      estimator = null;
      res(true);
    });
    button.on('click', (ev)=>{ estimator.close(); estimator = null; res(false); });
  });

  if (calibrationSuccess) {
    div.empty();
    div.append("<p>That's enough singing.  Calibration is done.  On with the main event.</p>");
    button = $('<input type=button>').attr('value',"Nifty").appendTo(div);
    await new Promise((res)=>{button.on('click',res);});
  }
  div.remove();

  let apiUrl = window.location.protocol+'//'+window.location.host+window.bucketServerUrl;
  client = new SingerClient({context, apiUrl,
                             offset: 42, // We'll change this before doing anything
                             username:clientId, secretId:Math.round(Math.random()*1e6)}); // TODO: understand these
}

export class BucketSinging {
  constructor({boxColor, lyrics, background_opts, backing_track, videoUrl, leader, mark_base, justInit}) {
    this.isLead = leader ? document.cookie.indexOf(leader) != -1 : window.location.pathname.endsWith('lead');
    this.div = $('<div>').appendTo($('body'));
    this.video_div = $('<div class="bucket-video">').css('z-index',-1).appendTo($('body'));
    putOnBox([this.div, this.video_div], boxColor);
    this.lyrics = lyrics;
    this.background = background_opts;
    this.backing_track = backing_track;
    this.mark_base = mark_base;
    this.justInit = justInit;
      
    this.dbg = $('<div>').css({position: 'absolute',
                               left: '0',
                               top: '30vh',
                               fontSize: "12px",
                               fontFamily: "Verdana",
                               opacity: .5,
                               marginLeft: 10,
                               color: 'white'}).appendTo($('body'));
    this.dbg.append('Debugging info:').append($('<br>'));
    if ( ! cssInit ){
      $('<style>').text(css).appendTo($('head'));
      cssInit = true;
    }
    
    let button = $('<input type="button" class="initialize-button" value="Click here to Initialize Singing">').appendTo(this.div).on('click', acknowledgeMic);
    micAcknowledgedPromise.then(() => {
      button.remove();
    });

    this.clientReadyPromise = client ? Promise.resolve() : contextReadyPromise.then(initClient);
    this.clientReadyPromise.then(() => {
      this.onClientReady();
    });

    if (videoUrl) {
      this.video = $(`video[src='${videoUrl}']`);
      this.video.removeClass('hidden').addClass('bbs-video').css({opacity: 0}).prependTo(this.video_div);
      this.clientReadyPromise.then(() => {
        this.markReachedListener = async ({detail: {data}}) => {
          if (data !== 'backingTrackStart') {
            return;
          }
          client.removeEventListener('markReached', this.markReachedListener);
          delete this.markReachedListener;
          this.video.animate({opacity: 1}, 500);
          let videoElem = this.video[0];
          videoElem.play();
          this.metadataReceivedListener = ({detail: {metadata}}) => {
            let elapsedAudioSeconds = (metadata.client_read_clock - metadata.song_start_clock) / metadata.server_sample_rate;
            console.log(`Sync Status: audio = ${elapsedAudioSeconds}, video = ${videoElem.currentTime}`);
            if (Math.abs(elapsedAudioSeconds - videoElem.currentTime) > 0.1) {
              videoElem.currentTime = elapsedAudioSeconds;
            }
          };
          client.addEventListener('x_metadataReceived', this.metadataReceivedListener);
        };
        client.addEventListener('markReached', this.markReachedListener);
      });
    }
  }
    
  show_lyrics() {
    this.div.addClass('lyrics');
    this.lyricEls = {};
    this.countdown = $('<div>').css('text-align','center').appendTo(this.div);
    for (let i in this.lyrics) {
      this.lyricEls[i] = $('<span>').text(this.lyrics[i]).appendTo(this.div);
    }
  }

  async from_server() {}

  getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

  get_slot() {
    if (this.isLead) return 0
    if (!calibrationSuccess) return 2
    return this.getRandomInt(3)
  }

  async onClientReady() {
    if (this.justInit) {
      this.destroy();
      return;
    }
    this.show_lyrics();
    client.micMuted = false;
    client.speakerMuted = false;
    let slot = this.get_slot()
    let offset = (slot+1) * 3;
    client.change_offset(offset);
    this.dbg.append('slot '+slot+' -> offset '+offset).append($('<br>'));
    if (this.isLead) {
      await new Promise((res)=>{setTimeout(res,2000);}); // TODO: understand why we need this and make it so we don't
      if (this.backing_track) {
        this.dbg.append('bt='+this.backing_track).append($('<br>'));
        client.x_send_metadata("backingTrack", this.backing_track);
      }
      client.x_send_metadata("markStartSinging", true);
      $('<div>').text('You are lead singer.  '+
                      (this.backing_track ? 'Instrumentals will being soon.  ' : 'Sing when ready.  ') + 
                      'Click anywhere in the lyric area when you begin a new line')
                .css({background:'#444'})
                .prependTo(this.div);
    } else {
      for (let i=-4; i<0; i++) {
        this.lyricEls[i] = $('<span>').text(-i+'... ').appendTo(this.countdown);
      }
    }
    if (this.isLead) {
      this.div.css('cursor','pointer');
      let cur = 0;
      this.div.on('click',async ()=>{
        client.declare_event(this.mark_base+cur);
        if (cur == 0) {
          for (let i=1; i<=4; i++) {
            client.declare_event(this.mark_base-i, i);
          }
        }
        await this.handleLyric(cur);
        cur++;
      });
    } else {
      client.event_hooks.push( async (lid)=>{
        await this.handleLyric(lid-this.mark_base);
      });
    }
  }

  async handleLyric(lid) {
    this.div.find('span.current').removeClass('current').addClass('old');
    let elem = this.lyricEls[lid];
    if (! elem ) return;
    elem.addClass('current');
    if (this.background.zoomSpeed && lid>=0) {
      bkgZoom(Math.pow(this.background.zoomSpeed, lid), this.background.zoomCenter);
    }
    if (this.background.backgrounds && lid in this.background.backgrounds) {
      bkgSet('namedimg/'+this.background.backgrounds[lid]);
    }

    let otop = elem.position().top;
    let target = elem.parent().height() / 3;  
    while (true) {
      if (otop < target) break;
      this.div[0].scrollTop += 4;
      let ntop = elem.position().top;
      if (ntop == otop) break;
      otop = ntop;
      await new Promise( (res)=>{setTimeout(res,16);} );
    }
  };
  
  destroy(){
    if (client) {
      client.micMuted = true;
      client.speakerMuted = true;
    }
    if (this.video) {
      this.video.removeClass('bbs-video').addClass('hidden').appendTo(document.body);
      if (this.markReachedListener) {
        client.removeEventListener('markReached', this.markReachedListener);
      }
      if (this.metadataReceivedListener) {
        client.removeEventListener('x_metadataReceived', this.metadataReceivedListener);
      }
    }
    this.div.remove();
    this.video_div.remove();
    $('#calibrator-popup').remove();
    if (estimator) {
      estimator.close();
      estimator = null;
    }
  }
  
}
