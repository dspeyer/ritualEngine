import * as bbs from './BucketSinging/app.js';
import { putOnBox } from '../../lib.js';


let initted = false;
let calibrated = false;

async function init_audio({audio_offset, server_url}){
    if (initted) {
        //await bbs.set_offset(audio_offset);
        bbs.set_mute(false);
        return;
    }
    
    await bbs.wait_for_mic_permissions();
    let devices = await navigator.mediaDevices.enumerateDevices();
    let input_device_id=null, output_device_id=null;

    for (let dev of devices) {
        if ( ! input_device_id && (dev.kind === 'audioinput')) {
            input_device_id = dev.deviceId;
            console.log(dev);
        }
        if ( ! output_device_id && (dev.kind === 'audiooutput')) {
            output_device_id = dev.deviceId;
            console.log(dev);
        }
    }

    if ( ! ( input_device_id && output_device_id ) ) {
        alert("Did not find devices: "+devices);
    }

    await bbs.start({ input_device_id, output_device_id, audio_offset, server_url,
                      script_prefix: '/widgets/BucketSinging/',
                      loopback: 'none',
                      input_opts: {}
    });

    await new Promise( (res) => {setTimeout(res, 500);} ); // Not sure we need this, but timing with start was weird
    initted = true;
}

async function calibrate() {
    if (calibrated) {
        return;
    }
    let div = $('<div>').css({position: 'absolute',
                              left: '10vw',
                              width: '80vw',
                              top: '30vh',
                              height: '40vh',
                              background: 'black',
                              color: 'white',
                              border: '2px outset #0ff'}).appendTo($('body'));
    let clickVolume = 50;
    bbs.register_click_volume_getter(()=>clickVolume);
    let louderTimeout, louder;
    louder = () => {
        if (clickVolume >= 100) return;
        clickVolume += 10;
        bbs.click_volume_change()
        louderTimeout = setTimeout(louder, 1200);
    }
    louder();
    $('<h2>').text('Calibrating your audio system...').appendTo(div);
    $('<h4>').text('Please place your microphone so it can hear your speakers').appendTo(div);
    $('<h4>').text('Or tap your microphone in time with the clicks').appendTo(div);
    let clickElem = $('<p>').text('Heard 0 clicks so far').appendTo(div);
    let button = $('<input type=button value="Don\'t bother; just stick me where no one will hear">').appendTo(div);
    let res;
    let cancelled = false;
    let p = new Promise((r)=>{res=r;});
    button.on('click', ()=>{ cancelled=true; res(); });
    bbs.learned_latency_hooks.push((msg)=>{
        clickElem.text("Heard " + msg.samples + " clicks so far.");
        clearTimeout(louderTimeout);
        if (msg.samples >= 5) res();
        else louderTimeout = setTimeout(louder, 2000);
    });
    bbs.set_estimate_latency_mode(true);
    await p;
    bbs.set_estimate_latency_mode(false);
    div.remove();
    calibrated = true;
    return cancelled;
}


export class BucketSinging {
  constructor({boxColor, lyrics, cleanup}) {
    let client_id;
    this.islead = window.location.pathname.endsWith('lead');
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

    $('<style>').text(
      "  div {  " +
        "  color: white; " +
        "} " +
        "div.lyrics { " +
        "  display: flex; " +
        "  flex-direction: column; " +
        "  justify-content: space-between; " +
        "  overflow-y: auto; " +
        "} " +
        "div.lyrics span { " +
        "  font-size: 16pt; " +
        "  text-align: center; " +
        "  white-space: pre; " +
        "} " +
        "div.lyrics span.current { " +
        "  font-weight: bold; " +
        "  text-shadow: 0 0 1px yellow; " +
        "} " +
        "div.lyrics span.old { " +
        "  color: grey; " +
        "} "
    ).appendTo($('head'));
  }

  async from_server({client_ids, server_url}) {
    if (this.page == 'ready') return; // We are *not* idempotent
    if (client_ids.indexOf(this.client_id) == -1) return; // If the server hasn't heard us, we aren't ready
    this.page = 'ready';
    
    // If alarms come through *before* we draw lyrics
    this.savedAlarms = [];
    bbs.event_hooks.push( (lid)=>{ this.savedAlarms.push(lid); } );
    
    if ( ! initted) {
      let button = $('<input type="button" value="Click here to Initialize Singing">').appendTo(this.div);
      await new Promise( (res) => { button.on('click', res); } );
      button.remove();
    }
    
    let pos = this.islead ? -1 : client_ids.indexOf(this.client_id);
    let audio_offset = Math.floor(Math.log(pos + 2) / Math.log(2)) * bbs.minimum_safe_offset_delta_s + 2;
    
    await init_audio({audio_offset, server_url});
    let cancelled = await calibrate(this.div);
    if (cancelled) {
      bbs.stop();
      pos = client_ids.length;
      audio_offset = Math.floor(Math.log(pos + 2) / Math.log(2)) * bbs.minimum_safe_offset_delta_s + 7;
      await init_audio({audio_offset, server_url});
    }
    
    if ( ! this.lyrics.length) {
      bbs.set_mute(true);
      return;
    }
    
    this.div.addClass('lyrics');
    let lyricEls = {};
    if ( ! this.islead) {
      let countdown = $('<div>').css('text-align','center').appendTo(this.div);
      for (let i=-4; i<0; i++) {
        lyricEls[i] = $('<span>').text(-i+'... ').appendTo(countdown);
      }
    }
    for (let i in this.lyrics) {
      lyricEls[i] = $('<span>').text(this.lyrics[i]).appendTo(this.div);
    }
    if (this.islead) {
      bbs.init_events();
      $('<p>').text('You are the lead singer.  Begin when ready.  Click anywhere in the '+
                    'lyricsbox at the beginning of each line.').appendTo(this.div);
      this.div.css('cursor','pointer');
      let cur = 0;
      this.div.on('click',async ()=>{
        this.div.find('span.current').removeClass('current').addClass('old');
        lyricEls[cur].addClass('current');
        await this.scrollTo(lyricEls[cur]);
        bbs.declare_event(cur);
        if (cur == 0) {
          for (let i=1; i<=4; i++) {
            bbs.declare_event(-i, i);
          }
        }
        cur++;
      });
    } else {
      for (let i of this.savedAlarms) {
        if (i in lyricEls) {
          lyricEls[i].addClass('old');
        }
      }
      bbs.event_hooks.push( async (lid)=>{
        this.div.find('span.current').removeClass('current').addClass('old');
        if (lyricEls[lid]) {
          lyricEls[lid].addClass('current');
          await this.scrollTo(lyricEls[lid]);
        }
      });
    }
  }

  async scrollTo(elem) {
    let otop = elem.offset().top;
    while (true) {
      if (otop < 200) break;
      this.div[0].scrollTop += 4;
      let ntop = elem.offset().top;
      if (ntop == otop) break;
      otop = ntop;
      await new Promise( (res)=>{setTimeout(res,16);} );
    }
  };
  
  destroy(){
    if (this.cleanup) {
      bbs.stop();
    } else {
      bbs.set_mute(true);
    }
    this.div.remove();
  }
  
}
