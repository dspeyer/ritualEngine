import {MicEnumerator, openMic, BucketBrigadeContext, SingerClient, VolumeCalibrator, LatencyCalibrator} from './BucketSinging/app.js';
import { putOnBox, bkgSet, bkgZoom, retrieveParameter, persistParameter, warnUserAboutError, wrappedFetch } from '../../lib.js';
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
  div.slots {
    display:flex;
    color: white;
    background: rgba(0,0,0,0.5);
    font-family: Gill Sans;
    margin: auto;
    width: fit-content;
  }
  div.slotCol {
    display:inline-block;
    text-align: center;
    padding: 5px;
    border: solid 1px rgba(255,255,200,.5);
    position:relative;
    width: 25px;
    height: 16px;
    font-size:12px;
    cursor:pointer;
    border-radius:3px;
    margin-right:4px;
    background-color:rgba(80,80,40);
    border-radius: 0 0 28% 28%;
  }
  div.slotCol.selected {
    background-color:rgba(150,150,60)
  }
  .slot-label {
      margin-right: 6px;
      padding:4px;
      font-size:12px;   
  }
  div.tooltip {
    display:none;
    background:rgba(0,0,0,.5);
    color: white;
    cursor: pointer;
    padding: 8px;
    position:relative;
    top: -135px;
    left: -5px;
    width: 250px;
    border-radius:5px;
    text-align:left;
  }
  div.tooltip p {
      margin-top:.5em;
      margin-bottom:.5em;
  }
  div.slotCol:hover {
    border: solid 1px rgba(255,255,200,.8);
    background-color:rgba(100,100,40)
  }
  div.slotCol:hover .tooltip {
    display:block
  }
`;

let secretId = Math.round(Math.random()*1e9);

let backingTrackStartedRes;
let backingTrackStartedPromise = new Promise((res) => {
    backingTrackStartedRes = res;
});

async function initContext(){
    let div = $('<div>').addClass('modaldlg')
                        .appendTo($('body'));

    div.append('Searching for microphone...');

    let mics = await (new MicEnumerator()).mics();
    let mic = mics[0]; // TODO: be smarter?
    console.log('Chose mic: ',mic);
    let micStream = await openMic(mic.deviceId);
    let mycontext = new BucketBrigadeContext({micStream});
    addEventListener('error', () => {
        mycontext.close();
    });
    await mycontext.start_bucket();

    const CALIBRATION_SAVE_DURATION = 6 * 60 * 60;  // 6 hours
    let now_s = Date.now() / 1000;

    const saved_calibration = retrieveParameter("saved_calibration")

    if (saved_calibration === null) {
        console.log("No saved calibration data, gotta calibrate.");
    } else {
        const {
            latency: saved_latency,
            input_gain: saved_input_gain,
        } = saved_calibration;

        console.log("Using saved latency and calibration values:", saved_latency, "input_gain:", saved_input_gain);
        mycontext.send_local_latency(saved_latency);
        mycontext.send_input_gain(saved_input_gain);
        context = mycontext;

        // Any time we retrieve this, bump out the expiration another 6 hours. This prevents a timeout in the middle of an event, but ensures we won't retain it overnight.
        persistParameter("saved_calibration", {
            latency: saved_latency,
            input_gain: saved_input_gain,
        }, CALIBRATION_SAVE_DURATION);

        $('<p>').text("Found microphone and calibration for it: all is well!").appendTo(div);
        setTimeout(()=>{div.remove();}, 500);
        return;
    }

    if (window.skipCalibration) {
        mycontext.send_local_latency(150);
        context = mycontext;
        div.remove();
        return;
    }

    div.empty();
    div.append(`<div>Before we begin setting up your audio, is there any point?  If you're: <ul>
                  <li> in a noisy area <em>(such as sharing a room with others who are using this app, on other devices)</em>
                  <li> using bluetooth
                  <li> or just desirous that no-one hear you
                </ul> we'll set you up to never be heard.</div>`);
    let buttonyes = $('<input type=button class="yes-button" value="Yes, calibrate me.  None of those issues apply.">').appendTo(div);
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
    div.append("<p>First we'll measure the <b>latency</b> of your audio hardware. We'll make some beeps, and listen to them on the server.</p><p>Please:</p><ol><li>turn your volume to max</li><li>put your headphones where your microphone can hear them. <em>(if you're wearing over-ear headphones, lift them off your ear so your microphone can hear)</em></li></ol>");
    div.append($('<br>'));
    let button = $('<input type=button class="yes-button ready-button">').attr('value',"I read the instructions. Start the LOUD beeping!").appendTo(div);
    await new Promise((res)=>{button.on('click',res);});


    let retryBeeping = true;
    let latency_cal_result = null;
    while (retryBeeping) {
        div.empty();
        div.append("<p>Beeping... (make sure your mic can hear the beeps, i.e. turn volume to max and hold your headphones where your mic can hear them).</p><p><em>(We'll listen for about 6 beeps. If it doesn't work, you can try again, or give up)</em></p>");
        div.append('Beeps heard: ');
        let heard = $('<span>').appendTo(div);
        div.append($('<br><br>'));
        button = $('<input type=button>').attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.")
                                         .appendTo(div);
        div.append(button);
        p = new Promise((res_)=>{res=res_;});
        let estimator = new LatencyCalibrator({context:mycontext, clickVolume:100}); // TODO: gradually increasing volume?
        estimator.addEventListener('beep', (ev)=>{
            console.log(ev);
            if (ev.detail.done) res(ev.detail);
            heard.text(ev.detail.samples);
        });
        button.on('click', (ev)=>{ calibrationFail=true; estimator.close(); res(); });
        latency_cal_result = await p;
        if (latency_cal_result?.success === false) {
            div.empty();
            div.append('Failed to get a clear latency measurement.  Maybe increase volume or fiddle with audio hardware?');
            p = new Promise((r)=>{res=r;});
            $('<input type=button value="Try again">').on('click',res).appendTo(div);
            button = $('<input type=button>')
                .attr('value',"Forget it; I'll be uncalibrated.  Just don't let anyone hear me.")
                .on('click', ()=>{ calibrationFail=true; retryBeeping=false; res(); })
                .appendTo(div);
            await p;
        } else {
            retryBeeping = false;
        }
    }

    if (calibrationFail) {
        div.remove();
        mycontext.send_ignore_input(true);  // XXX ??
        context = mycontext;
        return;
    }

    div.empty();
    div.append($("<p>Now we need to calibrate your <b>volume</b>.</p><p>Please sing at the same volume you plan to during "+
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
    let estimator = new VolumeCalibrator({context: mycontext});
    estimator.addEventListener('volumeChange', (ev)=>{ $('#curvol').text((ev.detail.volume*1000).toPrecision(3)) });
    estimator.addEventListener('volumeCalibrated', res);
    button.on('click', (ev)=>{ calibrationFail=true; estimator.close(); res(); });
    const volume_cal_result = await p;

    console.log("Saving calibration data: latency:", latency_cal_result, "volume:", volume_cal_result);
    persistParameter("saved_calibration", {
        latency: latency_cal_result.estLatency,
        input_gain: volume_cal_result.detail.inputGain,
    }, CALIBRATION_SAVE_DURATION);

    div.empty();
    div.append("<p>That's enough singing.  Calibration is done.  On with the main event.</p>");
    button = $('<input type=button>').attr('value',"Nifty").appendTo(div);
    await new Promise((res)=>{button.on('click',res);});

    div.remove();
    context = mycontext;
}

export class BucketSinging {
    constructor({boxColors, lyrics, cleanup, background_opts, videoUrl, page, startMuted}) {
        this.div = $('<div>').appendTo($('body'));
        putOnBox(this.div, boxColors.lyrics);
        if (videoUrl) {
            this.video_div = $('<div class="bbs-video-wrapper">').appendTo($('body'));
            putOnBox(this.video_div, boxColors.video);
        }
        if (boxColors.slots) {
            this.slotsUi = $('<div class=slots>').appendTo($('body'));
            putOnBox(this.slotsUi, boxColors.slots);
        } else {
            $('#widget-extra-ctrls').empty();
            this.slotsUi = $('<div class=slots>').appendTo($('#widget-extra-ctrls'));
        }
        this.lyrics = lyrics;
        this.cleanup = cleanup;
        this.background = background_opts;
        this.page = -1;
        this.centrallyMuted = startMuted;
        this.btstart = NaN;
        this.timings = [];

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

        if ( ! context && page!='welcome') {
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
        let body = new FormData();
        body.append('action', 'ready');
        body.append('calibrationFail', calibrationFail);
        body.append('clientId', clientId);
        body.append('islead', islead);
        wrappedFetch('widgetData', {method: 'POST', body});
    }

    createSlotButtons (slot, slotCounts) {
        if (this.slotsUi) {
            this.slotsUi.empty();
            for (let i in slotCounts) {
                this.createSlotButton(slot, i, slotCounts)
            }
        }
    }

    createSlotButton(slot, i, slotCounts) {
        let button = $('<div class=slotCol>')
            .append($('<div>').text(slotCounts[i]))
            .appendTo(this.slotsUi);

        const tooltip = $('<div class=tooltip>').appendTo(button)
        tooltip.append(`<p><b>Bucket ${i}</b></p>`)

        if (i==slot) {
            button.addClass('selected')
            tooltip.append('<p><em>You are in this bucket.<em></p>')
        } else if ( ! calibrationFail) {
            if (i == 3) {
                tooltip.append(`<p>Click to join</p>`)
            } else {
                tooltip.append(`<p>Click to join (Requires wired headphones)</p>`)
            }
            button.on('click',()=>{
                let body = new FormData();
                body.append('action', 'pickslot');
                body.append('clientId', clientId);
                body.append('slot', i);
                wrappedFetch('widgetData', {method: 'POST', body});
            });
        }
        if (i==0) {
            tooltip.append('<p><em>Songleader. Singers in this bucket only hear the backing track, but everyone can hear them.</em></p><p><em>Join if you want to help lead the song!</em></p>')
        } else if (i==3) {
            tooltip.append('<p><em>Listen Only. Singers in the last bucket can hear everyone, but nobody hears them.</em></p>')
        } else {
            tooltip.append('<p><em>Singers in this bucket can be heard by people in later buckets, and can hear people in earlier buckets</em></p>')
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
        let username = 'RE/'+chatname[0]+' ['+clientId.substr(0,10)+'...]';
        this.client = new SingerClient({
            context, apiUrl, offset, username, secretId,
            speakerMuted: Boolean(retrieveParameter('speakerMuted')),
            micMuted: this.centrallyMuted || Boolean(retrieveParameter('micMuted')),
        });
        addEventListener('error', this.clientErrorListener = () => {
            this.client.close();
        });
        $('#mic-mute-button').on('click.bucketSinging', () => {
            this.client.micMuted = this.centrallyMuted || retrieveParameter('micMuted');
        });
        $('#speaker-mute-button').on('click.bucketSinging', () => {
            this.client.speakerMuted = retrieveParameter('speakerMuted');
        });

        this.client.addEventListener('markReached', async ({detail: {data}}) => {
            if (data === 'backingTrackStart') {
                this.bkstart = (new Date()).getTime();
                backingTrackStartedRes();
            }
        });
        await new Promise((res)=>{ this.client.addEventListener('connectivityChange',res); });

        this.cancelConnectivityError = null;
        this.client.addEventListener('connectivityChange', () => {
            if (this.client.hasConnectivity) {
                this.cancelConnectivityError();
                this.cancelConnectivityError = null;
            } else {
                this.cancelConnectivityError = warnUserAboutError();
            }
        });
        this.client.addEventListener('audioLag', () => {
            warnUserAboutError()();
        });

        if (this.video) {
            this.client.addEventListener('markReached', async ({detail:{data}})=>{
                if (data == 'backingTrackStart') {
                    this.video.animate({opacity: 1}, 500);
                    this.video[0].play();
                    if (this.video.width()==0) {
                        await new Promise((res)=>{this.video.on('loadedmetadata', res)});
                        this.video.off('loadedmetadata');
                    }
                    // let left = (this.video_div.width() - this.video.width()) / 2 + 'px';
                    // this.video.css({left});
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

        this.createSlotButtons(slot, slotCounts)

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
                        this.client.declare_event(-i, i);
                    }
                }
                await this.handleLyric(cur);
                cur++;
            });
        } else {
            this.client.addEventListener('markReached', (ev) => {
                console.log('markreached',ev?.detail);
                let lid = ev?.detail?.data;
                if (typeof lid === 'string' && lid.startsWith('mute')) {
                    this.client.micMuted = this.centrallyMuted = true;
                } else if (typeof lid === 'string' && lid.startsWith('unmute')) {
                    this.centrallyMuted = false;
                    this.client.micMuted = retrieveParameter('micMuted');
                } else if (lid == parseInt(lid)) {
                    this.handleLyric(lid);
                }
            });
        }
    }

    async handleLyric(lid) {
        if (lid>0 && lid%8==0) {
            rotateAvatars();
        }
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
            $('#mic-mute-button').off('click.bucketSinging');
            $('#speaker-mute-button').off('click.bucketSinging');
            if (this.cancelConnectivityError) {
                this.cancelConnectivityError();
            }
        }
        this.div.remove();
        this.dbg.remove();
        if (this.video) this.video.removeClass('bbs-video').addClass('hidden').appendTo(document.body);
        if (this.video_div) this.video_div.remove();
        if (this.slotsUi) this.slotsUi.remove();
    }
}


export async function welcome() {
    await initContext();
}
