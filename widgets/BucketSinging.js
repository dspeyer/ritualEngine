import {MicEnumerator, openMic, BucketBrigadeContext, SingerClient, VolumeCalibrator, LatencyCalibrator} from './BucketSinging/app.js';
import { putOnBox, bkgSet, bkgZoom, setMuted } from '../../lib.js';

let context = null;
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


async function initContext(){
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
  button.on('click', (ev)=>{ estimator.close(); res(); });
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
  button.on('click', (ev)=>{ estimator.close(); res(); });
  await p;
  
  div.empty();
  div.append("That's enough singing.  Calibration is done.  On with the main event.");
  button = $('<input type=button>').attr('value',"Nifty").appendTo(div);
  await new Promise((res)=>{button.on('click',res);});
  div.remove();
}

export class BucketSinging {
  constructor({boxColor, lyrics, cleanup, background_opts, leader}) {
    let client_id;
    if (leader) {
      this.islead = (document.cookie.indexOf(leader) != -1);
    } else {
      this.islead = window.location.pathname.endsWith('lead');
    }
    if (this.islead) {
      client_id = 0;
    } else {
      client_id = Math.round(Math.random()*1e5); // Too big for birthday paradox, too small for FP trouble
    }
    this.client_id = client_id
    $.post('widgetData', {client_id});
    this.div = $('<div>').appendTo($('body'));
    putOnBox(this.div, boxColor);
    this.page = 'unready';
    this.lyrics = lyrics;
    this.cleanup = cleanup;
    this.background = background_opts;
    this.dbg = $('<div>').css({position: 'absolute',
                               left: '0',
                               top: '30vh',
                               background: 'white',
                               color: 'black'}).appendTo($('body'));
    this.dbg.append('Debugging info:').append($('<br>'));
    
    if ( ! cssInit ){
      $('<style>').text(css).appendTo($('head'));
      cssInit = true;
    }
      
  }

  async from_server({client_ids, server_url, mark_base}) {
    //this.dbg.append('mark_base='+mark_base).append($('<br>'));
    if (this.page == 'ready') return; // We are *not* idempotent
    if (client_ids.indexOf(this.client_id) == -1) return; // If the server hasn't heard us, we aren't ready
    this.page = 'ready';
    setMuted(true);
    
    if ( ! context) {
      let button = $('<input type="button" value="Click here to Initialize Singing">').appendTo(this.div);
      await new Promise( (res) => { button.on('click', res); } );
      button.remove();
      await initContext();
    }

    let pos = this.islead ? -1 : client_ids.indexOf(this.client_id);
    let offset = Math.floor(Math.log(pos + 2) / Math.log(2)) * 5 + 2;

    this.dbg.append('offset='+offset).append($('<br>'));

    if ( ! this.lyrics.length) {
      setMuted(false);
      return;
    }
    
    let apiUrl = window.location.protocol+'//'+window.location.host+server_url;
    this.client = new SingerClient({context, offset, apiUrl,
                                    username:this.client_id, secretId:this.client_id}); // TODO: understand these
    await new Promise((res)=>{ this.client.addEventListener('connectivityChange',res); });
    if (this.islead) {
      //TODO: figure out what this actually does, and why we need to wait
      await new Promise((res)=>{setTimeout(res,2000);});
      this.client.x_send_metadata("markStartSinging", true);
    }
    
    this.div.addClass('lyrics');
    let lyricEls = {};
    if (this.islead) {
      $('<div>').text('You are lead singer.  Begin when ready.  Click anywhere in the lyric area when you reach a new line')
                .css({background:'black'})
                .appendTo(this.div);
    } else {
      let countdown = $('<div>').css('text-align','center').appendTo(this.div);
      for (let i=-4; i<0; i++) {
        lyricEls[i] = $('<span>').text(-i+'... ').appendTo(countdown);
      }
    }
    for (let i in this.lyrics) {
      lyricEls[i] = $('<span>').text(this.lyrics[i]).appendTo(this.div);
    }
    if (this.islead) {
      this.div.css('cursor','pointer');
      let cur = 0;
      this.div.on('click',async ()=>{
        this.client.declare_event(mark_base+cur);
        if (cur == 0) {
          for (let i=1; i<=4; i++) {
            this.client.declare_event(mark_base-i, i);
          }
        }
        await this.handleLyric(cur, lyricEls);
        cur++;
      });
    } else {
      this.client.event_hooks.push( async (lid)=>{
        await this.handleLyric(lid-mark_base, lyricEls);
      });
    }
  }

  async handleLyric(lid, lyricEls) {
    this.div.find('span.current').removeClass('current').addClass('old');
    let elem = lyricEls[lid];
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
    if (this.client) {
      this.client.close();
    }
    this.div.remove();
    setMuted(false);
  }
  
}
