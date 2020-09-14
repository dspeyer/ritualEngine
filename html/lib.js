export function putOnBox(elem, color) {
    let box = $('path[stroke="'+color+'"]')
    let rect = box[0].getBoundingClientRect();
    box.hide();
    elem.css('position','absolute');
    for (let i of ['top','left','width','height']) {
        elem.css(i,rect[i]);
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
        console.log({x,y,r,nx,ny,nr,h,t:(y==r)});
        x = nx;
        y = ny;
        r = nr;
        pc = npc;
    }
    return circles;
}

let base_placements = [];
function fill(div, n) {
    let h = div.height();
    let w = div.width();
    if ( ! base_placements.length ) {
        for (let sf=0.99; sf>0.89; sf-=0.01) {
            base_placements.push(placements(sf, w, h));
        }
    }
    let i=0;
    for (; i<base_placements.length; i++) {
        if (base_placements[i].length >= n) break;
    }
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
            ps.push({x: Math.random()*w, y:Math.random()*h, r:13, back:true});
        }
    }
    div.empty();
    return ps.map(putcircle.bind(null,div));
}

function putcircle(d,{x,y,r,label,back}) {
    let s = Math.round(2*r) - 2 + 'px';
    let left = Math.round(x-r) + 1 + 'px';
    let top = Math.round(y-r) + 1 + 'px';
    let img = $('<img>').css({position:'absolute', width: s, height: s, left, top})
                        .appendTo(d);
    if (back) img.css('z-index', -1);
    if (label) {
        img.label = $('<span>').text('Daniel Speyer')
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
    return img;
}

let curCircles = [];
export function showParticipants(participants) {
    let div = $('#participants');
    if (curCircles.length != participants.length) {
        curCircles = fill(div, participants.length);
    }
    for (let i in participants) {
        curCircles[i].attr('src', participants[i].img);
        if (curCircles[i].label) {
            curCircles[i].label.text(participants[i].name);
        }
    }
}
