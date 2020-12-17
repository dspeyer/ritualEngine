import { retrieveParameter, wrappedFetch } from "./lib.js";

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

export let nvideos = 6;
export let staticRotateHint = 10;
let curVidRot = 0;
let curStaRot = 0;
export function rotateAvatars() {
    $('.selected-avatar').removeClass('selected-avatar');
    curVidRot += (nvideos - 1) & 254;
    curStaRot += staticRotateHint;
    redraw();
}

let circles = [];
export function redraw(force) {
    let div = $('#participants');
    let savedVideoElems = {};
    if ((circles.length != participants.length) || force) {
        if (video) savedVideoElems = saveVideosBeforeDestruction();
        circles = fillAsDesired(div, participants.length);
    }
    if (video) {
        console.log('savedVideoElems logging <<<');
        console.log("savedVideoElems before filling",savedVideoElems);
        setVideoAvatars(savedVideoElems);
        console.log("savedVideoElems after filling",savedVideoElems);
        for (let i in savedVideoElems) {
            let video = savedVideoElems[i];
            video.track.detach(video[0]);
            video.remove();
            console.log('removed savedVideoElem',i,video);
        }
        console.log('>>> savedVideoElems logging');
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
        if (r==r0) nr = Math.floor(nr/1.2); // TODO: Find a number with more logic behind it
        rows.push(nr);
        left -= nr;
    }
    if (left<0) {
        let rem = - left / (n - left);
        rem *= (rows.length + 1) / rows.length;
        for (let i=rows.length-1; i>=0; i--) {
            let rh = Math.min(Math.ceil(rows[i]*rem), -left);
            console.log({rem,rh,i,rowsi:rows[i],left,n});
            left += rh;
            rows[i] -= rh;
        }
    }
    if (left!=0) {
        // Not sure if this will ever happen
        rows[rows.length-1] += left;
    }
    if (rows.length > 2) {
        staticRotateHint = rows[1];
    }
    let ps=[];
    let rb = r0;
    let yb = h-r0;
    let y,r;
    let label=true;
    for (let rn of rows) {
        let xs = w/rn;
        if (yb==h-r0) {
            let xc = r0;
            for (let i=0; i<Math.floor(rn/2); i++) {
                let extra = r0 * (Math.pow(2, 4*Math.pow((xc/w)-.5,2)) - 1);
                y = yb - extra;
                r = rb + extra;
                xc += extra;
                let xl = (2*i+1) * xs/2;
                let x = (xc*(Math.floor(rn/2-i)) + xl*i) / Math.floor(rn/2);
                ps.push({x,y,r,z:Math.round(r),label});
                ps.push({x:w-x,y,r,z:Math.round(r),label});
                xc += extra;
                xc += xs;
            }
            if (rn%2) {
                ps.push({x:w/2,y:yb,r:r0,z:Math.round(r0),label});
            }
        } else {
            let x = xs / 2;
            for (let i=0; i<rn; i++) {
                let extra = r0 * (Math.pow(2, 4*Math.pow((x/w)-.5,2)) - 1);
                y = yb - 2*extra;
                r = rb;
                ps.push({x,y,r,z:Math.round(r),label});
                x += xs;
            }
            label = false;
        }
        yb -= 1.5 * rb;
        rb *= 2/3;
    }
    div.empty();
    return ps.map(putcircle.bind(null,div));
}

let setGlobalClickHandler = false;
function putcircle(d,{x,y,r,label,z,br}) {
    let s = Math.round(2*r) - 2 + 'px';
    let left = Math.round(x-r) + 1 + 'px';
    let top = Math.round(y-r) + 1 + 'px';
    if (br===undefined) br=50;
    let div = $('<div>').css({
            position:'absolute', 
            width: s, 
            height: s, 
            left, 
            top, 
            overflow: 'hidden'
        }).appendTo(d);
        
    if (z) div.css('z-index', z);
    div.img = $('<img class="avatar">').css({borderRadius: br+'%'}).appendTo(div);
    div.video = $('<video class="avatar">').css({borderRadius: br+'%'}).appendTo(div);
    div.video.hide();
    if (label) {
        div.label = $('<span>').text('Placeholder')
                               .addClass('avatar-label')
                               .appendTo(div);
    }
    div.on('click', (ev) => {
        $('.selected-avatar').removeClass('selected-avatar');
        div.addClass('selected-avatar');
        ev.stopPropagation();
        console.log('local click');
    });
    if ( ! setGlobalClickHandler) {
        $('body').on('click', () => {
            console.log('global click');
            $('.selected-avatar').removeClass('selected-avatar');
        });
        setGlobalClickHandler = true;
    }
    if (window.isLead) {
        $('<input type="button" class="avatar-control" value="Click Me">').on('click', () => {
            alert("This button doesn't do anything yet.");
        }).appendTo(div);
    }
    div.on('mouseover', (ev) => {
        let target = ev.target;
        for (; target.tagName!='DIV'; target=target.parentElement);
        console.log('mouseover',ev);
        let client = target.client;
        if ( ! client) return;
        console.log(client);
        let html = `
          <table class=hoverinfo>
            <tr><th>Name:</th><td colspan=2 class=name></td></tr>
            <tr><th>ClientId:</th><td class="cid eq"></td><td class="long">${client.id.substr(0,10)}\u2026</tr>
            <tr><th>Room:</th><td class="room eq"></td><td class="long">${client.room.substr(0,10)}\u2026</tr>
            <tr><th>Audio:</th><td colspan=2>${!!hasAudioTrack[client.id]}</td></tr>
            <tr><th>Video:</th><td colspan=2 class=video></td></tr>
          </table>
        `;
        let tab = $(html).css({bottom:(window.innerHeight-ev.clientY+20)+'px'})
                         .appendTo($('#everything'));
        if (ev.clientX < window.innerWidth/2) {
            tab.css({left:(ev.clientX+20)+'px'});
        } else {
            tab.css({right:(window.innerWidth-ev.clientX+20)+'px'});
        }
        tab.find('.name').text(client.name);
        tab.find('.cid.eq').text((client.id==clientId)?'[=]':'[\u2260]');
        tab.find('.room.eq').text((client.room==currentRoomId)?'[=]':'[\u2260]');
        if ($(target).find('video')[0].srcObject) {
            tab.find('.video').text('has');
        } else if (client.id in videosToPlace) {
            tab.find('.video').text('wants');
        } else {
            tab.find('.video').text('no');
        }
        setTimeout(()=>{tab.remove()}, 5*1000);
    });
    div.on('mouseout', ()=> {
        $('.hoverinfo').remove();
    });
    return div;
}

function saveVideosBeforeDestruction() {
    let out = {};
    for (let circle of circles) {
        if (circle.videoOf) {
            out[circle.videoOf] = circle.video;
            circle.video.detach();
            circle.video.track = circle.track;
            circle.video.css({opacity:0}).appendTo($('body'));
            delete circle.track;
            delete circle.videoOf;
        }
    }
    return out;
}

/*************************** Twilio  ******************************/

let videosToPlace = {};
let currentRoomId = null;
let room = null;
let localVideo = null;
let twilioAudioEnabled = false;
let hasAudioTrack = {};
let localAudioTrack = null;

function setVideoAvatars(savedVideoElements) {
    videosToPlace = {};
    let mes = participants.filter((x)=>(x.id==clientId));
    let same = participants.filter((x)=>(x.room==currentRoomId && x.id!=clientId));
    let diff = participants.filter((x)=>(x.room!=currentRoomId && x.id!=clientId));
    if (same.length) curVidRot %= same.length;
    let samea = same.slice(curVidRot);
    let sameb = same.slice(0,curVidRot);
    if (diff.length) curStaRot %= diff.length;
    let diffa = diff.slice(curStaRot);
    let diffb = diff.slice(0,curStaRot);
    let clients = [].concat(mes,samea,sameb,diffa,diffb);
    let vidsPlaced = 0;
    console.log({act:'rotating',curVidRot,curStaRot});
    console.log({act:'seting circles',clients,circles,mes,samea,sameb,diffa,diffb});
    for (let i in clients) {
        let client = clients[i];
        let circle = circles[i];
        circle[0].client = client;
        circle.label?.text(client.name);
        let cachebuster = client.hj + '_';
        if (circle.width() > 10) {
            cachebuster += Math.round(((new Date()).getTime()+(i*10*1000))/(300*1000));
        }
        circle.img.attr('src', 'clientAvatar/'+client.id+'?'+cachebuster);
        if (twilioAudioEnabled) {
            circle.css({opacity: (hasAudioTrack[client.id] ? 1 : .2)});
        }
        if (circle.videoOf == client.id) {
            vidsPlaced += 1;
            continue;
        }
        if (circle.videoOf) {
            circle.video.hide();
            circle.track.detach(circle.video[0]);
            circle.video[0].srcObject = null;
            delete circle.videoOf;
            delete circle.track;
        }
        if (vidsPlaced >= nvideos) {
            continue;
        }
        if (client.id in savedVideoElements) {
            vidsPlaced += 1;
            circle.video.remove();
            circle.video = savedVideoElements[client.id];
            circle.video.detach();
            circle.append(circle.video);
            circle.video.css({opacity:1});
            // TODO: Unify with putVideoInCircle?
            // TODO: Worry about varying border-radius
            circle.videoOf = client.id;
            circle.track = savedVideoElements[client.id].track;
            delete savedVideoElements[client.id];
            console.log('deleting '+client.id+' from savedVideoElements because reused');
            continue;
        }
        if (client.id == clientId) {
            vidsPlaced += 1;
            putVideoInCircle(circle, localVideo, clientId);
            continue;
        }
        if (client.room == currentRoomId) {
            vidsPlaced += 1;
            videosToPlace[client.id] = circle;
        }
    }
    attachAllVideos();
}


function attachAllVideos() {
    if (!room) return;
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
    if (!track) return;
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
    console.log({cameraChoice});
    if (cameraChoice[0] && ! localVideo) {
        let opts = { width: 100, height: 100};
        if (cameraChoice[0]!='uninitialized') {
            opts.deviceId = {exact:cameraChoice[0]};
        }
        localVideo = await Twilio.Video.createLocalVideoTrack(opts);
    } else {
        localVideo = null;
    }
    if ( ! localAudioTrack) {
        let res;
        let p = new Promise((r)=>{res=r;});
        Twilio.Video.createLocalAudioTrack().then((lat)=>{
            localAudioTrack = lat;
            res();
        }).catch((e)=>{throw e;});
        setTimeout(res, 3000);
        await p;
        if (localAudioTrack) {
            localAudioTrack.disable();
        } else {
            $('<h3>').css({color:'red',background:'white',opacity:1,position:'absolute'})
                .text("Warning: timed out creating twilio local audio track")
                .animate({opacity:0},50000)
                .prependTo($('body'));
        }
//        localAudioTrack = await Twilio.Video.createLocalAudioTrack();
    }

    let tracks = [ localVideo, localAudioTrack ];
    tracks = tracks.filter((x)=>(x));
    
    try {
        room = await Twilio.Video.connect(token, { name: roomId, tracks });
    } catch (error) {
        room = null;
        currentRoomId = null;
        console.log(error);
        wrappedFetch('twilioRoomFail/'+clientId, {method: 'POST'});
        return;
    }
    console.log('connected to room '+roomId);
    addEventListener('beforeunload', () => {
        room.disconnect();
    });
    room.on('trackUnsubscribed', (track) => {
        $(track.detach()).remove();
    });
    room.on('trackSubscribed', (track, publication, participant) => {
        console.log('subscribe event',track,publication,participant);
        if (publication.kind == 'video') {
            if (participant.identity in videosToPlace) {
                console.log('== put video');
                putVideoInCircle(videosToPlace[participant.identity], track, participant.identity);
            }
        }
        if (publication.kind == 'audio' && twilioAudioEnabled) {
            console.log('== put audio');
            hasAudioTrack[participant.identity] = true;
            if (!retrieveParameter('speakerMuted')) {
                $(track.attach()).appendTo($('body'));
            }
            for (let circle of circles) {
                circle.css({opacity: (hasAudioTrack[circle[0].client.id] ? 1 : 0.2)});
            }
        }
    });
    attachAllVideos();
}

$('#mic-mute-button').on('click', () => {
    if (twilioAudioEnabled) {
        if (retrieveParameter('micMuted')) {
            muteMic();
        } else {
            unmuteMic();
        }
    }
});

$('#speaker-mute-button').on('click', () => {
    if (twilioAudioEnabled) {
        if (retrieveParameter('speakerMuted')) {
            muteSpeaker();
        } else {
            unmuteSpeaker();
        }
    }
});

export function setTwilioAudioEnabled(nv) {
    if (nv == twilioAudioEnabled) return;
    if ( ! room) return;
    twilioAudioEnabled = nv;
    hasAudioTrack = {[clientId]: true};
    if (nv) {
        if (!retrieveParameter('micMuted')) {
            unmuteMic();
        }
        if (!retrieveParameter('speakerMuted')) {
            unmuteSpeaker();
        }
        for (let [sid, participant] of room.participants) {
            for (let [_, track] of participant.audioTracks) {
                if (track.kind=='audio' && track.track && typeof(track.track.attach)=='function') {
                    hasAudioTrack[participant.identity] = true;
                }
            }
        }
        for (let circle of circles) {
            circle.css({opacity: (hasAudioTrack[circle[0].client.id] ? 1 : 0.2)});
        }
    } else {
        if (!retrieveParameter('micMuted')) {
           muteMic();
        }
        if (!retrieveParameter('speakerMuted')) {
            muteSpeaker();
        }
        for (let circle of circles) {
            circle.css({opacity: 1});
        }
    }
}

function unmuteMic() {
    if (localAudioTrack) localAudioTrack.enable();
}

function unmuteSpeaker() {
    for (let [sid, participant] of room.participants) {
        for (let [_, track] of participant.audioTracks) {
            if (track.kind=='audio' && track.track && typeof(track.track.attach)=='function') {
                $(track.track.attach()).appendTo($('body'));
            }
        }
    }
}

function muteMic() {
    if (localAudioTrack) localAudioTrack.disable();
}

function muteSpeaker() {
    for (let [sid, participant] of room.participants) {
        for (let [_, track] of participant.audioTracks) {
            if (track.kind=='audio' && track.track && typeof(track.track.detach)=='function') {
                $(track.track.detach()).remove();
            }
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
    wrappedFetch('clientAvatar/'+clientId, {method: 'POST', body: fd});
    setTimeout(sendVideoSnapshot, 5*1000);
}
