import {MicEnumerator, openMic, BucketBrigadeContext, SingerClient, VolumeCalibrator, LatencyCalibrator} from './BucketSinging/app.js';
import { putOnBox, bkgSet, bkgZoom, setMuted } from '../../lib.js';

let context = null;
let client = null;
let calibrationFail = false;
let mysteryInitPromise = null;
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



async function initContext(server_url){
  let mics = await (new MicEnumerator()).mics();
  let mic = mics[0]; // TODO: be smarter?
  console.log('Chose mic: ',mic);
  let micStream = await openMic(mic.deviceId);
  context = new BucketBrigadeContext({micStream});
  await context.start_bucket();

  let div = $('<div>').css({background:'rgba(0.5, 0.5, 0.5, 0.6)',
                            fontSize: '16pt',
                            textShadow: '0 0 1px black',
                            position: 'absolute',
                            top: 'calc( 50vh - 8em )',
                            height: '16em',
                            left: '20vw',
                            right: '20vw',
                            border: '2px outset #777'})
                      .appendTo($('body'));
  div.append("First we'll measure the <b>latency</b> of your audio hardware. Please turn your volume to max and put your "+
             "headphones where your microphone can hear them.  Or get ready to tap your microphone in time to the beeps.");
  div.append($('<br>'));
  let button = $('<input type=button>').attr('value',"I'm ready: start the beeping!").appendTo(div);
  await new Promise((res)=>{button.on('click',res);});
  
  div.empty();
  div.append('Beeping...');
  div.append($('<br>'));
  div.append('Beeps heard: ');
  let heard = $('<span>').appendTo(div);
  div.append($('<br>'));
  button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.").appendTo(div);
  div.append(button);
  let res;
  let p = new Promise((res_)=>{res=res_;});
  let estimator = new LatencyCalibrator({context, clickVolume:100}); // TODO: gradually increasing clickVolume
  estimator.addEventListener('beep', (ev)=>{
    console.log(ev);
    if (ev.detail.done) res();
    heard.text(ev.detail.samples);
  });
  button.on('click', (ev)=>{ calibrationFail=true; estimator.close(); res(); });
  await p;

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
  div.append($("<p>Current volume: <span id=curvol></span> unhelpful volume units</p>"));
  button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.").appendTo(div);
  div.append(button);
  p = new Promise((res_)=>{res=res_;});
  window.reportedVolume = {}; // WHY DO WE NEED THIS?
  estimator = new VolumeCalibrator({context});
  estimator.addEventListener('volumeChange', (ev)=>{ $('#curvol').text((ev.detail.volume*1000).toPrecision(3)) });
  estimator.addEventListener('volumeCalibrated', res);
  button.on('click', (ev)=>{ calibrationFail=true; estimator.close(); res(); });
  await p;
  
  div.empty();
  div.append("That's enough singing.  Calibration is done.  On with the main event.");
  button = $('<input type=button>').attr('value',"Nifty").appendTo(div);
  await new Promise((res)=>{button.on('click',res);});
  div.remove();

  let apiUrl = window.location.protocol+'//'+window.location.host+server_url;
  client = new SingerClient({context, apiUrl,
                             offset: 42, // We'll change this before doing anything
                             username:clientId, secretId:Math.round(Math.random()*1e6)}); // TODO: understand these
  await new Promise((res)=>{ client.addEventListener('connectivityChange',res); });
  mysteryInitPromise = new Promise((res)=>{setTimeout(res,2000);});
}

export class BucketSinging {
  constructor({boxColor, lyrics, cleanup, background_opts, videos, leader, server_url}) {
    let islead;
    if (leader) {
      islead = (document.cookie.indexOf(leader) != -1);
    } else {
      islead = window.location.pathname.endsWith('lead');
    }
    this.div = $('<div>').appendTo($('body'));
    this.video_div = $('<div>').css('z-index',-1).appendTo($('body'));
    putOnBox([this.div, this.video_div], boxColor);
    this.lyrics = lyrics;
    this.cleanup = cleanup;
    this.background = background_opts;
      
    this.dbg = $('<div>').css({position: 'absolute', display:'none',
                               left: '0',
                               top: '30vh',
                               background: 'white',
                               color: 'black'}).appendTo($('body'));
    this.dbg.append('Debugging info:').append($('<br>'));
    if ( ! cssInit ){
      $('<style>').text(css).appendTo($('head'));
      cssInit = true;
    }
    
    this.videos = {};
    if (Object.keys(videos).length>0) {
      this.init_videos(videos); // Async, we'll wait if we need to
    }
      
    if ( ! context) {
      let button = $('<input type="button" value="Click here to Initialize Singing">').appendTo(this.div);
      button.on('click', ()=>{
        button.remove();
        initContext(server_url).then(()=>{
          this.show_lyrics(lyrics);
          this.declare_ready(islead);
        });
      });
    } else {
      this.show_lyrics(lyrics);
      this.declare_ready(islead);
    }
  }

  async init_videos(videos) {
    let res;
    this.init_videos_promise = new Promise((res_)=>{res=res_;});
    if ( ! window.YT) {
      let script = $('<script>')
      script.appendTo($('head'));
      let p = new Promise((res)=>{script.on('load',res);});
      script.attr('src','https://www.youtube.com/iframe_api');
      await p;
    }
    while ( ! window.YT || ! window.YT.loaded) {
      this.dbg.append('awaiting YT...').append($('<br>'));
      await new Promise((res)=>{setTimeout(res,100);});
    }
    for (let lid in videos) {
      let res;
      let promise = new Promise((r)=>{res=r;});
      let holder = $('<div><div id=bbs_video'+lid+' style="margin:auto;display:block;"></div></div>')
        .css({position: 'sticky', zIndex:-999+lid, opacity:0})
        .prependTo(this.video_div);
      let player = new YT.Player('bbs_video'+lid, {
        videoId: videos[lid],
        events: {
          'onReady':()=>{console.log('YYYYYYYes Im ready!!!!');res();},
          'onStateChange':(event)=>{
            if (event.data == YT.PlayerState.ENDED) {
              holder.css('opacity', 0);
            }
          }
        }
      });
      this.videos[lid] = {holder,player,promise};
    }
    this.dbg.append('vids initted').append($('<br>'));
    res();
  }

  
  show_lyrics(lyrics) {
    this.div.addClass('lyrics');
    this.lyricEls = {};
    this.countdown = $('<div>').css('text-align','center').appendTo(this.div);
    for (let i in this.lyrics) {
      this.lyricEls[i] = $('<span>').text(this.lyrics[i]).appendTo(this.div);
    }
  }

  declare_ready(islead) {
    this.dbg.append('declaring ready islead='+islead).append($('<br>'));
    $.post('widgetData', {calibrationFail, clientId, islead});
  }

  async from_server({mark_base, slot, ready, backing_track, dbginfo}) {
    this.dbg.append(dbginfo+' ready='+ready).append($('<br>'));
    if (!ready || !client) return;
    if (this.slot === slot) return;
    this.slot = slot;
    client.micMuted = false;
    client.speakerMuted = false;
    setMuted(true);
    let offset = (slot+1) * 3;
    client.change_offset(offset);
    this.dbg.append('slot '+slot+' -> offset '+offset).append($('<br>'));

    
    if (slot==0) {
      //TODO: figure out what this actually does, and why we need to wait
      await mysteryInitPromise;
      await new Promise((res)=>{setTimeout(res,2000);});
      if (backing_track) {
        this.dbg.append('bt='+backing_track).append($('<br>'));
        client.x_send_metadata("backingTrack", backing_track);
      }
      client.x_send_metadata("markStartSinging", true);
    }
    
    if (slot==0) {
      $('<div>').text('You are lead singer.  '+
                      (backing_track ? 'Instrumentals will being soon.  ' : 'Sing when ready.  ') + 
                      'Click anywhere in the lyric area when you begin a new line')
                .css({background:'#444'})
                .prependTo(this.div);
    } else {
      for (let i=-4; i<0; i++) {
        this.lyricEls[i] = $('<span>').text(-i+'... ').appendTo(this.countdown);
      }
    }
    if (slot==0) {
      this.div.css('cursor','pointer');
      let cur = 0;
      this.div.on('click',async ()=>{
        client.declare_event(mark_base+cur);
        if (cur == 0) {
          for (let i=1; i<=4; i++) {
            client.declare_event(mark_base-i, i);
          }
        }
        await this.handleLyric(cur);
        cur++;
      });
    } else {
      client.event_hooks.push( async (lid)=>{
        await this.handleLyric(lid-mark_base);
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
    if (lid in this.videos) {
      await this.init_videos_promise;
      console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      await this.videos[lid].promise;
      console.log(this.videos[lid]);
      this.videos[lid].holder.animate({opacity:1},500);
      this.videos[lid].player.playVideo();
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
    this.div.remove();
    if (this.video_div) this.video_div.remove();
    setMuted(false);
  }
  
}
