let elemBoxPairs = [];

export function putOnBox(elems, color) {
    let box = $('path[stroke="'+color+'"]');
    if (! box.length) box = $('rect[stroke="'+color+'"]');
    if (! box.length) box = $('path[style*="stroke:'+color+'"]');
    if (! box.length) box = $('rect[style*="stroke:'+color+'"]');
    elemBoxPairs.push({elems,box});
    realPutOnBox({elems,box});
}

function realPutOnBox({elems, box}) {
    box.show();
    let rect = box[0].getBoundingClientRect();
    box.hide();
    if ( ! Array.isArray(elems)) elems = [ elems ];
    for (let elem of elems) {
        if (elem.parent().length == 0) continue;
        elem.css('position','absolute');
        for (let i of ['top','left','width','height']) {
            elem.css(i,rect[i]);
        }
    }
}    

$(window).resize(()=>{
    elemBoxPairs = elemBoxPairs.filter((p)=>(p.box.parent().length));
    for (let p of elemBoxPairs) {
        realPutOnBox(p);
    }
});

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
    
