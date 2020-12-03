export function putOnBox(elems, color) {
    let box = $('path[stroke="'+color+'"]')
    let rect = box[0].getBoundingClientRect();
    box.hide();
    if ( ! Array.isArray(elems)) elems = [ elems ];
    for (let elem of elems) {
        elem.css('position','absolute');
        for (let i of ['top','left','width','height']) {
            elem.css(i,rect[i]);
        }
    }
}    

export async function getPhoto(holder, output) {
    let stream = await navigator.mediaDevices.getUserMedia({ video: true });
    let settings = stream.getVideoTracks()[0].getSettings();
    let {width,height} = settings;
    if (width>height && window.innerWidth<window.innerHeight) {
        // Probable browser bug in video dimension handling
        [width,height] = [height,width];
    }
    let w,h,l,t;
    if (width/height > holder.width()/holder.height()) {
        w = holder.width();
        h = holder.width() * height / width;
        t = (holder.height() - h) / 2;
        l = 0;
    } else {
        h = holder.height();
        w = holder.height() * width / height;
        l = (holder.width() - w) / 2;
        t = 0;
    }
    let video = $('<video>').
                   css('position','absolute').
                   css('width',w+'px').
                   css('height',h+'px').
                   css('left',l+'px').
                   css('top',t+'px').
                   css('z-index',999).
                   appendTo(holder);
    video[0].srcObject = stream;
    video[0].play();
    let button = $('<input type="button" value="Take">').
                   css('position','absolute').
                   css('bottom','0').
                   css('left','40%').
                   css('right','40%').
                   css('padding','2em').
                   css('z-index','1000').
                   appendTo(holder);
    let p = new Promise( (res) => { button.click(res); } );
    await p;
    
    let canvas = $('<canvas width='+w+' height='+h+'>').appendTo($('body'));
    let context = canvas[0].getContext('2d');
    context.drawImage(video[0], 0, 0, w, h);
    let ret;
    if (output == 'blob') {
        // Why is this one a callback and the other a normal function?
        p = new Promise( (res) => { canvas[0].toBlob(res,'image/jpeg'); } );
        ret = await p;
    } else {
        ret = canvas[0].toDataURL('image/jpeg');
    }
    canvas.remove();
    video.remove();
    button.remove();
    return ret;
}

function square(x) { return x*x; } // The alternatives were uglier
function sqrt(x) { return x>=0 ? Math.sqrt(x) : 0; }
         
function placements(sf, w, h) {
    let r = h/2;
    let x = r;
    let xf=x, xl=x; // first, last
    let y = r;
    let pc = 1; // per-column
    let circles = [];
    while( x+r <= w ) {
        for (let i=0; i<pc; i++) {
            circles.push({x: (i==0)?xf:(i==pc-1)?xl:x,
                          y: y+i*2*r,
                          r: r,
                          label: (pc==1)&&((x==r)||(y!=r)) });
        }
                        
        let nr = Math.max(r*sf , 13);
        if (nr > h/4) nr *= sf;
        let npc = Math.floor(h/(2*nr));
        let ny;
        if (y == r) {
            ny = h - 2*nr*npc + nr;
        } else {
            ny = nr;
        }
        let nx = x + Math.max( sqrt( square(r+nr) - square(y-ny) ),
                               sqrt( square(r+nr) - square((y+2*r)-ny) ),
                               sqrt( square(r+nr) - square((y)-(ny+2*nr)) ) * (npc>1) );
        xf = nx;
        xl = nx;
        if (npc > pc) {
            if (ny == nr) {
                let xft = x + sqrt( square(r+nr) - square(y-ny) );
                xf = (nx + xft) / 2;
            } else {
                let xlt = x + sqrt( square(r+nr) - square((y)-(ny+2*nr)) );
                xl = (nx + xlt) / 2;
            }
        }
        x = nx;
        y = ny;
        r = nr;
        pc = npc;
    }
    return circles;
}

let base_placements = [];
function fillAsReaderQueue(div, n) {
    let h = div.height();
    let w = div.width();
    if ( ! base_placements.length ) {
        for (let sf=0.99; sf>0.89; sf-=0.01) {
            base_placements.push(placements(sf, w, h));
        }
    }
    let i=0;
    for (; i<base_placements.length-1; i++) {
        if (base_placements[i].length >= n) break;
    }
    console.log(base_placements[i]);
    let ps = JSON.parse(JSON.stringify(base_placements[i]));
    if (ps.length > n) {
        ps = ps.slice(0,n);
        let sx = w / (ps[n-1].x+ps[n-1].r);
        for (let p of ps) {
            p.x -= p.r
            p.x *= sx;
            if (p.x > 0) p.x += Math.random() * p.r * (sx-1) * 0.5; // Random shuffle, but not the first
            p.x += p.r
        }
    }
    if (ps.length < n) {
        for (let i=ps.length; i<n; i++) {
            ps.push({x: Math.random()*w, y:Math.random()*h, r:13, z:-1});
        }
    }
    div.empty();
    return ps.map(putcircle.bind(null,div));
}

function fillAsAuditorium(div, n) {
    let h = div.height();
    let w = Math.min(div.width(), window.innerWidth);
    console.log({h,w});
    let r0 = h/5; // h = 1/2 r0 + 3/2 sum(r0*(2/3)^i)
    let rows = [];
    let left = n;
    for (let r=r0; left>0; r*=2/3) {
        let nr = Math.floor(w/(2*r));
        rows.push(nr);
        left -= nr;
    }
    if (left<0) {
         let rem = - left / (n - left);
         for (let i=0; i<rows.length; i++) {
              let rh = Math.min(Math.round(rows[i]*rem), -left);
              console.log({rem,rh,i,rowsi:rows[i],left,n});
              left += rh;
              rows[i] -= rh;
             }
    }
    if (left!=0) {
        // Not sure if this will ever happen
        rows[rows.length-1] += left;
    }
    let ps=[];
    let r = r0;
    let y = h-r;
    let br = 0;
    for (let rn of rows) {
        let xs = w/rn;
        let x = xs / 2;
        for (let i=0; i<rn; i++) {
            ps.push({x,y,r,br,z:r});
            x += xs;
        }
        y -= (2 - br/200 - 0.25) * r; // TODO: make the Y's still add up with this extra spacing
        r *= 2/3;
        br = Math.min(br+20,50);
    }
    div.empty();
    return ps.map(putcircle.bind(null,div));
}

let fillAsDesired = null;
export function setParticipantStyle(rotate){
    fillAsDesired = rotate ? fillAsReaderQueue : fillAsAuditorium;
}

function putcircle(d,{x,y,r,label,z,br}) {
    let s = Math.round(2*r) - 2 + 'px';
    let left = Math.round(x-r) + 1 + 'px';
    let top = Math.round(y-r) + 1 + 'px';
    let div = $('<div>').css({position:'absolute', width: s, height: s, left, top})
                        .appendTo(d);
    if (z) div.css('z-index', z);
    if (br) div.css({borderRadius: br+'%', overflow: 'hidden'});
    div.img = $('<img>').css({width:'100%',height:'100%',position:'absolute'}).appendTo(div);
    div.video = $('<video>').css({width:'100%',height:'100%',position:'absolute'}).appendTo(div);
    div.video.hide();
    if (label) {
        div.label = $('<span>').text('Placeholder')
                               .css({position: 'absolute',
                                     bottom: '5px',
                                     left,
                                     width: s,
                                     'text-align': 'center',
                                     color:'white',
                                     'text-shadow': ('1px 1px 1px grey, -1px -1px 1px grey, ' +
                                                     '-1px 1px 1px grey, 1px -1px 1px grey'),
                                     'font-size': '14px',
                                    })
                               .appendTo(d);
    }
    return div;
}

let curCircles = [];
let videosToPlace = {};
export function showParticipantAvatars(participants, video) {
    let div = $('#participants');
    if (curCircles.length != participants.length) {
        curCircles = fillAsDesired(div, participants.length);
    }
    if (video) {
        videosToPlace = {};
        for (let i in participants) {
            let client = participants[i];
            curCircles[i].img.attr('src', 'clientAvatar/'+client.id+'?'+client.hj);
            if (curCircles[i].videoOf == client.id) continue;
            if (curCircles[i].videoOf) {
                curCircles.video.hide(); // TODO: detatch?  Likewise when n changes?
                delete curCircles.videoOf;
            }
            if (client.id == clientId) {
                putVideoInCircle(curCircles[i], localVideo, clientId)
            }
            if (client.room == currentRoomId) {
                videosToPlace[client.id] = curCircles[i];
            }
        }
        attachAllVideos();
    } else {
        for (let i in participants) {
            curCircles[i].img.attr('src', participants[i].img);
            if (curCircles[i].label) {
                curCircles[i].label.text(participants[i].name);
            }
        }
    }
}

function attachAllVideos() {
    for (let [sid, participant] of room.participants) {
        if (participant.identity in videosToPlace) {
            for (let [_, track] of participant.videoTracks) {
                if (track.kind=='video' && track.track && typeof(track.track.attach)=='function') {
                    putVideoInCircle(videosToPlace[participant.identity], track.track, participant.identity);
                    break
                }
            }
        }
    }
}

function putVideoInCircle(circle, track, id) {
    track.attach(circle.video[0]);
    circle.video.show();
    circle.videoOf = id;
    console.log('ARGGGGHH!!');
    if (id == clientId) {
        circle.video.css({transform:'scaleX(-1)', transformOrigin: 'center'});
        localVideoElement = circle.video[0];
        if ( ! svsRunning) {
            circle.video.on('loadeddata',sendVideoSnapshot);
            svsRunning = true;
        }
    } else {
        circle.video.css({transform: 'unset', transformOrigin: 'unset'});
    }
    if (id in videosToPlace) {
        delete videosToPlace[id];
    }
}

let localAudio;
let muted = false;
let currentRoomId = null;
let room = null;
let localVideo = null;

export async function twilioConnect(token, roomId) {
    if (roomId == currentRoomId) return;
    if (room) room.disconnect();
    currentRoomId = roomId;
    localVideo = await Twilio.Video.createLocalVideoTrack({ width: 100, height: 100 });
    let localTracks = [localVideo];
    if (useParticipantAudio) {
        localAudio = await Twilio.Video.createLocalAudioTrack();
        localTracks.push(localAudio);
    }
    room = await Twilio.Video.connect(token, { name: roomId, tracks: localTracks });
    console.log('connected to room '+roomId);
    addEventListener('beforeunload', () => {
        room.disconnect();
    });
    if (useParticipantAudio) {
        let span = $('<span>').css({background:'white',color:'black',position:'absolute',top:0,left:0}).appendTo($('body'));
        $('<span id="ismuted">').appendTo(span);
        $('<a>Change That</a>').css('border','thin blue outset').on('click',()=>{setMuted(!muted);}).appendTo(span);
        setMuted(false);
    }
    room.on('trackUnsubscribed', (track) => {
        $(track.detach()).remove();
    });
    room.on('trackSubscribed', (track, publication, participant) => {
        if (publication.kind == 'video') {
            if (participant.identity in videosToPlace) {
                putVideoInCircle(videosToPlace[participant.identity], track, participant.identity);
            }
        }
    });
    attachAllVideos();
}

let localVideoElement = null;
let svsRunning = false;
async function sendVideoSnapshot(){
    if ( ! localVideoElement) return;
    let canvas = $('<canvas width=100 height=100>').css({border:'thick cyan solid'}).appendTo($('body'));
    let context = canvas[0].getContext('2d');
    context.drawImage(localVideoElement, 0, 0, 100, 100);
    let blob = await new Promise( (res) => { canvas[0].toBlob(res,'image/jpeg'); } );
    canvas.remove();
    let fd = new FormData();
    fd.append('img', blob);
    $.ajax({
        type: 'POST',
        url: 'clientAvatar/'+clientId,
        data: fd,
        processData: false,
        contentType: false
    });
    setTimeout(sendVideoSnapshot, 5*1000);
}

export function setMuted(mut) {
    muted = mut;
    $('.participant-audio').prop('muted', muted);
    if (localAudio) {
        if (mut) {
            localAudio.disable();
            $('#ismuted').text('Twilio is muted');
        } else {
            localAudio.enable();
            $('#ismuted').text('Twilio is not muted');
        }
    }
}

function listenToAudio(track) {
    $(track.attach()).addClass('participant-audio').prop('muted', muted).appendTo('body');
}

export function setZoomMute(v) {} // TODO: something

let bkgElem = null;

export function bkgInit(par, url) {
    if ( ! bkgElem) {
        bkgElem = $('<div>').css({position: 'absolute',
                                  zIndex: -9999,
                                  'background-size': 'cover'})
                            .appendTo(par);
        console.log({bkgElem});
    }
    bkgSet(url);
}

export async function bkgSet(url) {
    let img = $('<img>').attr('src',url).css({display:'absolute',opacity:0}).appendTo($('body'));
    if (! img[0].complete) {
        console.log("awaiting imgload");
        await new Promise((res)=>{img.on('load',res);});
        console.log("done waiting");
    }
    img.remove();
    bkgElem.css({backgroundImage: 'url('+url+')',
                 width: '100%',
                 height: '100%',
                 top: '0px',
                 left: '0px'});
}

export function bkgZoom(amt,c) {
    bkgElem.css({width: (100*amt)+'%',
                 height: (100*amt)+'%',
                 top: (-100*(amt-1)*c[1])+'%',
                 left: (-100*(amt-1)*c[0])+'%'});
}
    
