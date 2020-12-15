import {MicEnumerator, openMic, BucketBrigadeContext, SingerClient, VolumeCalibrator, LatencyCalibrator} from './BucketSinging/app.js';
import { putOnBox, bkgSet, bkgZoom } from '../../lib.js';
import { rotateAvatars } from '../../avatars.js';

let context = null;
let calibrationFail = false;
let mysteryInitPromise = null;
let cssInit = false;
let css = `
  div.lyrics {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow-y: auto;
      text-shadow: 1px 1px 2px #777, -1px -1px 2px #777, 1px -1px 2px #777, -1px 1px 2px #777;
      scrollbar-width: none;
      color: white;
  }
  div.lyrics::-webkit-scrollbar {
      display: none;
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
  div.lyricdbg {
      position: absolute;
      left: 0;
      top: 30vh;
      color: white;
      opacity: 0.5;
  }
  div.lyricdbg:hover {
      opacity: 1;
  }
  div.initContext {
      background: rgba(0, 0, 0, 0.5);
      font-size: 14pt;
      text-shadow: 0 0 2px black;
      color: white;
      padding: 0 16px;
      position: absolute;
      top: calc( 50% - 8em );
      height: 16em;
      left: 20vw;
      right: 20vw;
      border: 2px outset #777;
      backdrop-filter: blur(8px);
      z-index: 9999;
  }
  div.initContext input {
      margin-top: 1em;
  }
  div.slots {
    display: flex;
    flex-direction: row;
    color: white;
    background: rgba(0,0,0,0.5);
  }
  div.slotCol {
    display: flex;
    flex-direction: column;
    text-align: center;
    padding: 5px;
  }
  div.slotCol div {
    padding: 5px;
  }
  div.bucket {
    background: #660;
    border-radius: 0 0 50% 50%;
    padding: 10px;
  }
  div.semibutton {
    border: 2px #990 outset;
    cursor: pointer;
    padding: 2px !important;
  }
`;

let backingTrackStartedRes;
let backingTrackStartedPromise = new Promise((res) => {
    backingTrackStartedRes = res;
});

async function initContext(){
    let mics = await (new MicEnumerator()).mics();
    let mic = mics[0]; // TODO: be smarter?
    console.log('Chose mic: ',mic);
    let micStream = await openMic(mic.deviceId);
    let mycontext = new BucketBrigadeContext({micStream});
    addEventListener('error', () => {
        mycontext.close();
    });
    await mycontext.start_bucket();

    if (window.skipCalibration) {
        mycontext.send_local_latency(150);
        context = mycontext;
        return;
    }

    let div = $('<div>').addClass('initContext')
                        .appendTo($('body'));
    div.append("<p>Before we begin, is there any point in setting up your audio?  If you're using bluetooth, "+
               "are in a very noisy area, or just don't want anyone to hear you, we'll set you up to never be heard.</p>");
    let buttonyes = $('<input type=button value="Yes, calibrate me.  None of those issues apply.">').appendTo(div);
    let buttonno = $('<input type=button value="Forget it; I\'ll be uncalibrated.  Just don\'t let anyone hear me">').appendTo(div);
    let res;
    let p = new Promise((r)=>{res=r});
    buttonyes.on('click',res);
    buttonno.on('click',()=>{calibrationFail=true;res()});
    await p;
    
    if (calibrationFail) {
        div.remove();
        context = mycontext;
        return;
    }
    
    div.empty();
    div.append("<p>First we'll measure the <b>latency</b> of your audio hardware.</p><p>Please turn your volume to max "+
               "and put your headphones where your microphone can hear them.  Or get ready to tap your microphone in "+
               "time to the beeps.</p>");
    div.append($('<br>'));
    let button = $('<input type=button>').attr('value',"I'm ready: Start the LOUD beeping!").appendTo(div);
    await new Promise((res)=>{button.on('click',res);});
    
    div.empty();
    div.append('<p>Beeping...</p>');
    div.append('Beeps heard: ');
    let heard = $('<span>').appendTo(div);
    div.append($('<br><br>'));
    button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.")
                                     .appendTo(div);
    div.append(button);
    p = new Promise((res_)=>{res=res_;});
    let estimator = new LatencyCalibrator({context:mycontext, clickVolume:100}); // TODO: gradually increasing clickVolume
    estimator.addEventListener('beep', (ev)=>{
        console.log(ev);
        if (ev.detail.done) res();
        heard.text(ev.detail.samples);
    });
    button.on('click', (ev)=>{ calibrationFail=true; estimator.close(); res(); });
    await p;
    
    if (calibrationFail) {
        div.remove();
        context = mycontext;
        return;
    }

    div.empty();
    div.append($("<p>Now we need to calibrate your <b>volume</b>.  Please sing at the same volume you plan to during "+
                 "the event. For your convenience, here are some lyrics:" +
                 "<blockquote><i>" +
                 "Mary had a little iamb, little iamb, little iamb<br/>" +
                 "And everywhere that Mary went scansion were sure to fail" +
                 "</i></blockquote></p>"));
    button = $('<input type=button>').attr('value',"I'm singing").appendTo(div);  
    await new Promise((res)=>{button.on('click',res);});
    button.remove();
    div.append($("<p><i>We're listening...</i></p>"));
    div.append($("<p>Current volume: <span id=curvol></span> unhelpful volume units</p>"));
    button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.")
                                     .appendTo(div);
    div.append(button);
    p = new Promise((res_)=>{res=res_;});
    window.reportedVolume = {}; // WHY DO WE NEED THIS?
    estimator = new VolumeCalibrator({context: mycontext});
    estimator.addEventListener('volumeChange', (ev)=>{ $('#curvol').text((ev.detail.volume*1000).toPrecision(3)) });
    estimator.addEventListener('volumeCalibrated', res);
    button.on('click', (ev)=>{ calibrationFail=true; estimator.close(); res(); });
    await p;
    
    div.empty();
    div.append("<p>That's enough singing.  Calibration is done.  On with the main event.</p>");
    button = $('<input type=button>').attr('value',"Nifty").appendTo(div);
    await new Promise((res)=>{button.on('click',res);});

    div.remove();
    context = mycontext;
}

export class BucketSinging {
    constructor({boxColors, lyrics, cleanup, background_opts, videoUrl, page}) {
        this.div = $('<div>').appendTo($('body'));
        putOnBox(this.div, boxColors.lyrics);
        if (videoUrl) {
            this.video_div = $('<div>').css({zIndex:-1,borderRadius:'50%',overflow:'hidden'}).appendTo($('body'));
            putOnBox(this.video_div, boxColors.video);
        }
        if (boxColors.slots) {
            this.slotsUi = $('<div class=slots>').appendTo($('body'));
            putOnBox(this.slotsUi, boxColors.slots);
        }
        this.lyrics = lyrics;
        this.cleanup = cleanup;
        this.background = background_opts;
        this.page = -1;
        this.btstart = NaN;
        this.timings = [];
        this.iswelcome = (page=='welcome');
        
        this.dbg = $('<div class=lyricdbg>').appendTo($('body'));
        this.dbg.append('Debugging info:').append($('<br>'));
        if ( ! cssInit ){
            $('<style>').text(css).appendTo($('head'));
            cssInit = true;
        }
        
        if (videoUrl) {
            this.video = $(`video[src='${videoUrl}']`);
            (this.video).removeClass('hidden')
                        .addClass('bbs-video')
                        .css({opacity: 0, height:'100%', position:'relative'})
                        .prependTo(this.video_div);
        }

        if (window.location.search == 'fake') {
            this.declare_ready();
            return;
        }
        
        if ( ! context) {
            let button = $('<input type="button" value="Click here to Initialize Singing">').appendTo(this.div);
            button.on('click', ()=>{
                button.remove();
                initContext().then(()=>{
                    this.show_lyrics(lyrics);
                    this.declare_ready();
                });
            });
        } else {
            this.show_lyrics(lyrics);
            this.declare_ready();
        }
    }
    
    show_lyrics(lyrics) {
        this.div.addClass('lyrics');
        this.lyricEls = {};
        this.countdown = $('<div>').css('text-align','center').appendTo(this.div);
        for (let i in this.lyrics) {
            this.lyricEls[i] = $('<span>').text(this.lyrics[i]).appendTo(this.div);
        }
    }

    declare_ready() {
        let islead = window.location.pathname.endsWith('lead');
        this.dbg.append('declaring ready islead='+islead).append($('<br>'));
        if (this.iswelcome) {
            $.post('welcomed/'+clientId);
        } else {
            $.post('widgetData', {action:'ready', calibrationFail, clientId, islead});
        }
    }

    async from_server({slot, ready, backing_track, dbginfo, justInit, server_url, lyricLead, slotCounts}) {
        this.dbg.append(dbginfo+' ready='+ready).append($('<br>'));
        if (!ready || !context) return;
        if (this.slot === slot) return;
        if (justInit) {
            this.destroy();
            return;
        }
        this.slot = slot;
        this.page = slot;  
        let offset = (slot+1) * 3 + 1;
        this.dbg.append('slot '+slot+' -> offset '+offset).append($('<br>'));

        if (this.client) {
            this.client.close();
            $('.current').removeClass('current');
            $('.old').removeClass('old');
            if (this.countdown) this.countdown.empty();
        }
            
        let apiUrl = server_url;
        let username = 'RE/'+chatname+' ['+clientId.substr(0,10)+'...]';
        let secretId = Math.round(Math.random()*1e6); // TODO: understand this
        this.client = new SingerClient({context, apiUrl, offset, username, secretId});
        addEventListener('error', this.clientErrorListener = () => {
            this.client.close();
        });

        this.client.addEventListener('markReached', async ({detail: {data}}) => {
            if (data === 'backingTrackStart') {
                this.bkstart = (new Date()).getTime();
                backingTrackStartedRes();
            }
        });
        await new Promise((res)=>{ this.client.addEventListener('connectivityChange',res); });

        if (this.video) {
            this.client.addEventListener('markReached', async ({detail:{data}})=>{
                if (data == 'backingTrackStart') {
                    this.video.animate({opacity: 1}, 500);
                    this.video[0].play();
                    if (this.video.width()==0) {
                        await new Promise((res)=>{this.video.on('loadedmetadata', res)});
                        this.video.off('loadedmetadata');
                    }
                    let left = (this.video_div.width() - this.video.width()) / 2 + 'px';
                    this.video.css({left});
                }
            });
            this.client.addEventListener('backingTrackUpdate', ({detail: {progress}}) => {
                // TODO: if (playing) ?
                console.log(`Sync Status: audio = ${progress}, video = ${this.video[0].currentTime}`);
                if (Math.abs(progress - this.video[0].currentTime) > 0.1) {
                    this.video[0].currentTime = progress;
                }
            });
        }
                
        if (this.slotsUi) {
            this.slotsUi.empty();
            for (let i in slotCounts) {
                let col = $('<div class=slotCol>')
                    .append($('<div class=bucket>').text(i))
                    .append($('<div>').text(slotCounts[i]))
                    .appendTo(this.slotsUi);
                if (i==slot) {
                    $('<div>').text('You').appendTo(col);
                } else if ( ! calibrationFail) {
                    $('<div class=semibutton>').text('Join')
                                               .on('click',()=>{
                                                   $.post('widgetData', {action:'pickslot', clientId, slot:i});
                                               })
                                               .appendTo(col);
                }
            }
        }
        
        if (lyricLead) {
            $('<div>').text('You are lead singer.  '+
                       (backing_track ? 'Instrumentals will begin soon.  ' : 'Sing when ready.  ') + 
                            'Click anywhere in the lyric area when you begin a new line')
                      .css({background:'#444'})
                      .prependTo(this.div);
        } else {
            for (let i=-4; i<0; i++) {
                this.lyricEls[i] = $('<span>').text(-i+'... ').appendTo(this.countdown);
            }
        }
        if (lyricLead) {
            this.div.css('cursor','pointer');
            let cur = 0;
            this.div.on('click',async ()=>{
                this.timings.push( ((new Date()).getTime() - this.bkstart) / 1000 );
                console.log(this.timings);
                this.client.declare_event(cur);
                if (cur == 0) {
                    for (let i=1; i<=4; i++) {
                        this.client.declare_event(i, i);
                    }
                }
                await this.handleLyric(cur);
                cur++;
            });
        } else {
            this.client.addEventListener('markReached', (ev) => {
                console.log('markreached',ev?.detail);
                let lid = ev?.detail?.data;
                if (lid == parseInt(lid)) {
                    this.handleLyric(lid);
                }
            });
        }
    }

    async handleLyric(lid) {
        rotateAvatars();
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
        if (this.client) {
            this.client.close();
            removeEventListener('error', this.clientErrorListener);
        }
        this.div.remove();
        this.dbg.remove();
        if (this.video) this.video.removeClass('bbs-video').addClass('hidden').appendTo(document.body);
        if (this.video_div) this.video_div.remove();
        if (this.slotsUi) this.slotsUi.remove();
    }
    
}
