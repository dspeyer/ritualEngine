let fillAsDesired = null;
export function setParticipantStyle(rotate){
    fillAsDesired = rotate ? fillAsReaderQueue : fillAsAuditorium;
}

let participants = [];
let video = false;
export function setParticipants(p,v) {
    participants = p;
    video = v;
    redraw();
}

let circles = [];
export function redraw(force) {
    let div = $('#participants');
    if ((circles.length != participants.length) || force) {
        if (video) detachAllVideos();
        circles = fillAsDesired(div, participants.length);
    }
    if (video) {
        setVideoAvatars();
    } else {
        for (let i in participants) {
            circles[i].img.attr('src', participants[i].img);
            if (circles[i].label) {
                circles[i].label.text(participants[i].name);
            }
        }
    }
}

$(window).resize(()=>{
    if (circles.length) {
        redraw(/*force=*/true);
    }
});

/*************************** Placement Schemes ******************************/

function square(x) { return x*x; } // The alternatives were uglier
function sqrt(x) { return x>=0 ? Math.sqrt(x) : 0; }

function rq_placements(sf, w, h) {
    let r = h/2;
    let x = r;
    let xf=x, xl=x; // first, last
    let y = r;
    let pc = 1; // per-column
    let out = [];
    while( x+r <= w ) {
        for (let i=0; i<pc; i++) {
            out.push({x: (i==0)?xf:(i==pc-1)?xl:x,
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
    return out;
}

let base_placements = [];
function fillAsReaderQueue(div, n) {
    let h = div.height();
    let w = div.width();
    if ( ! base_placements.length ) {
        for (let sf=0.99; sf>0.89; sf-=0.01) {
            base_placements.push(rq_placements(sf, w, h));
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

function putSimpleAvatar(d) {
    let div = $('<div class="simple-avatar">').appendTo(d);
    div.img = $('<img class="simple-avatar-image">').appendTo(div);
    div.video = $('<video class="simple-avatar-video">').appendTo(div);
    div.video.hide();
    return div
}

function fillAsSimple(div, n) {
    let ps = []
    for (let r=0; r<n; r++) {
        ps.push({})
    }
    return ps.map(putSimpleAvatar.bind(null,div));
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
    let br = 50;
    for (let rn of rows) {
        let xs = w/rn;
        let x = xs / 2;
        for (let i=0; i<rn; i++) {
            ps.push({x,y,r,br,z:r});
            x += xs;
        }
        y -= (2 - br/200 - 0.25) * r; // TODO: make the Y's still add up with this extra spacing
        r *= 2/3;
        br = 50 //Math.min(br+20,50);
    }
    div.empty();
    return ps.map(putcircle.bind(null,div));
}

function putcircle(d,{x,y,r,label,z,br}) {
    let s = Math.round(2*r) - 2 + 'px';
    let left = Math.round(x-r) + 1 + 'px';
    let top = Math.round(y-r) + 1 + 'px';
    let div = $('<div>').css({position:'absolute', width: s, height: s, left, top,
                              border: '1px rgba(255,255,255,0.5) solid'})
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

/*************************** Twilio  ******************************/

let videosToPlace = {};
let currentRoomId = null;
let room = null;
let localVideo = null;
let twilioAudioEnabled = false;
let hasAudioTrack = {};
let localAudioTrack = null;

function setVideoAvatars() {
    videosToPlace = {};
    let same = participants.filter((x)=>(x.room==currentRoomId));
    let diff = participants.filter((x)=>(x.room!=currentRoomId));
    participants = same.concat(diff);
    for (let i in participants) {
        let client = participants[i];
        let cachebuster = client.hj + '_' + Math.round(((new Date()).getTime()+(i*10000))/300000);
        circles[i].img.attr('src', 'clientAvatar/'+client.id+'?'+cachebuster);
        if (twilioAudioEnabled) {
            circles[i].css({opacity: (hasAudioTrack[client.id] ? 1 : .2)});
        }
        if (circles[i].videoOf == client.id) continue;
        if (circles[i].videoOf) {
            circles[i].video.hide();
            circles[i].track.detach(circles[i].video[0]);
            delete circles.videoOf;
            delete circles.track;
        }
        if (client.id == clientId) {
            putVideoInCircle(circles[i], localVideo, clientId);
        }
        if (client.room == currentRoomId) {
            videosToPlace[client.id] = circles[i];
        }
    }
    attachAllVideos();
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

function detachAllVideos() {
    for (let circle of circles) {
        if (circle.track) {
            circle.track.detach(circle.video[0]);
        }
    }
}


function putVideoInCircle(circle, track, id) {
    track.attach(circle.video[0]);
    circle.video.show();
    circle.videoOf = id;
    circle.track = track;
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


export async function twilioConnect(token, roomId) {
    if (roomId == currentRoomId) return;
    if (room) room.disconnect();
    currentRoomId = roomId;
    localVideo = await Twilio.Video.createLocalVideoTrack({ width: 100, height: 100 });
    room = await Twilio.Video.connect(token, { name: roomId, tracks: [localVideo] });
    console.log('connected to room '+roomId);
    addEventListener('beforeunload', () => {
        room.disconnect();
    });
    room.on('trackUnsubscribed', (track) => {
        $(track.detach()).remove();
    });
    room.on('trackSubscribed', (track, publication, participant) => {
        if (publication.kind == 'video') {
            if (participant.identity in videosToPlace) {
                putVideoInCircle(videosToPlace[participant.identity], track, participant.identity);
            }
        }
        if (publication.kind == 'audio' && twilioAudioEnabled) {
            hasAudioTrack[participant.identity] = true;
            $(track.attach()).appendTo($('body'));
            for (let circle of circles) {
                if (circle.videoOf == participant.identity) {
                    circle.css({opacity:1});
                }
            }
        }
    });
    attachAllVideos();
}

export function setTwilioAudioEnabled(nv) {
    if (nv == twilioAudioEnabled) return;
    hasAudioTrack = {[clientId]: true};
    if (nv) {
        twilioAudioEnabled = true;
        console.log('trying to get local audio');
        Twilio.Video.createLocalAudioTrack().then(function(lat) { // Don't await this. If it hangs, let it hang
            console.log('got local audio');
            room.localParticipant.publishTrack(lat);
            localAudioTrack = lat;
        });
        for (let [sid, participant] of room.participants) {
            for (let [_, track] of participant.videoTracks) {
                if (track.kind=='audio' && track.track && typeof(track.track.attach)=='function') {
                    $(track.track.attach()).appendTo($('body'));
                    hasAudioTrack[participant.identity] = true;
                }
            }
        }
        for (let circle of circles) {
            circle.css({opacity: (hasAudioTrack[circle.videoOf] ? 1 : 0.2)});
        }
    } else {
        twilioAudioEnabled = false;
        if (localAudioTrack) {
            localAudioTrack.stop();
            localAudioTrack = null;
        }
        for (let [sid, participant] of room.participants) {
            for (let [_, track] of participant.videoTracks) {
                if (track.kind=='audio' && track.track && typeof(track.track.detach)=='function') {
                    $(track.track.detach()).remove
                }
            }
        }
        for (let circle of circles) {
            circle.css({opacity: 1});
        }
    }
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
