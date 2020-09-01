import * as bbs from './BucketSinging/app.js';

// TODO: unify
function putOnBox(elem, color) {
    let box = $('path[stroke="'+color+'"]')
    let rect = box[0].getBoundingClientRect();
    box.hide();
    elem.css('position','absolute');
    for (let i of ['top','left','width','height']) {
        elem.css(i,rect[i]);
    }
}    

export class BucketSinging {
  constructor({boxColor, lyrics}) {
    let client_id = Math.round(Math.random()*1e3); // Too big for birthday paradox, too small for FP trouble
    this.client_id = client_id
    $.post('widgetData', {client_id});
    this.div = $('<div>').appendTo($('body'));
    putOnBox(this.div, boxColor);
    this.page = 'unready';
    this.lyrics = lyrics;

    $('<style>').text(
      "  div {  " +
        "  color: white; " +
        "} " +
        "div.lyrics { " +
        "  display: flex; " +
        "  flex-direction: column; " +
        "  justify-content: space-between; " +
        "} " +
        "div.lyrics span { " +
        "  font-size: 16pt; " +
        "  text-align: center; " +
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
    $('<input type="button" value="Click here">').on('click',this.init_audio.bind(this, client_ids, server_url)).appendTo(this.div);
  }

  async init_audio(client_ids, server_url){
    this.div.empty();
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

    let pos = client_ids.indexOf(this.client_id);
    let audio_offset = Math.floor(Math.log(pos + 1) / Math.log(2)) * bbs.minimum_safe_offset_delta_s;
    console.log({pos,audio_offset,client_ids,cid:this.client_id,when:'in BucketSinging.js'});
    this.offset = audio_offset;

    $('<div>').text('Audio offset: '+audio_offset).css({color:'white',position:'absolute',bottom:0}).appendTo($('body'));
    
    await bbs.start({ input_device_id, output_device_id, audio_offset, server_url,
                      script_prefix: '/widgets/BucketSinging/',
                      loopback: 'none',
                      input_opts: {}
                    });

    setTimeout(this.calibrate.bind(this), 500);
  }

  calibrate() {
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
    $('<h2>').text('Calibrating your audio system...').appendTo(this.div);
    $('<h4>').text('Please place your microphone so it can hear your speakers').appendTo(this.div);
    let clickElem = $('<p>').text('Heard 0 clicks so far').appendTo(this.div);
    bbs.learned_latency_hooks.push((msg)=>{
      clickElem.text("Heard " + msg.samples + " clicks so far.");
      clearTimeout(louderTimeout);
      if (msg.samples >= 5) requestAnimationFrame( this.calibration_done.bind(this) );
      else louderTimeout = setTimeout(louder, 2000);
    });
    bbs.estimate_latency_toggle();
  }

  calibration_done() {
    bbs.estimate_latency_toggle();
    this.div.empty();
    this.div.addClass('lyrics');

    let lyricEls = {};
    if (this.offset > 0) {
      let countdown = $('<div>').appendTo(this.div);
      for (let i=-Math.floor(Math.min(this.offset,10)); i<0; i++) {
        lyricEls[i] = $('<span>').text(-i+'... ').appendTo(countdown);
      }
    }
    for (let i in this.lyrics) {
      lyricEls[i] = $('<span>').text(this.lyrics[i]).css('white-space','pre').appendTo(this.div);
    }
    if (this.offset == 0) {
      $('<p>').text('You are the lead singer.  Begin when ready.  Click anywhere in the '+
                    'lyricsbox at the beginning of each line.').appendTo(this.div);
      this.div.css('cursor','pointer');
      let cur = 0;
      this.div.on('click',()=>{
        this.div.find('span.current').removeClass('current').addClass('old');
        lyricEls[cur].addClass('current');
        
        bbs.declare_event(cur);
        if (cur == 0) {
          for (let i=1; i<=10; i++) {
            bbs.declare_event(-i, i);
          }
        }
        cur++;
      });
    } else {
      bbs.event_hooks.push( (lid)=>{
        this.div.find('span.current').removeClass('current').addClass('old');
        if (lyricEls[lid]) {
          lyricEls[lid].addClass('current');
        }
      });
    }
  }

  destroy(){
    bbs.stop();
    this.div.remove();
  }
  
}
