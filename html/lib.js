let elemBoxPairs = [];

export function putOnBox(elems, color) {
    let box = $('path[stroke="'+color+'"]');
    if (! box.length) box = $('rect[stroke="'+color+'"]');
    if (! box.length) box = $('path[style*="stroke:'+color+'"]');
    if (! box.length) box = $('rect[style*="stroke:'+color+'"]');
    if (! box.length) {
        let convertedColor = $('<div>').css({background:color})[0].style.backgroundColor;
        let maybe = $('path, rect');
        for (let i=0; i<maybe.length; i++) {
            let stroke = maybe[i].style.stroke;
//            console.log({i,maybe:maybe[i],stroke,color,convertedColor});
            if (stroke==color || stroke==convertedColor) {
                box=maybe;
                break;
            }
        }
    }
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

const STATE_KEY = "ritual_engine_persisted_state";

function getOurState() {
    console.log("Getting saved ritual engine state from local storage.")
    var ourStateRaw = localStorage.getItem(STATE_KEY);
    if (ourStateRaw === null) {
        console.log("No saved state found.")
        return {};
    }
    var ourState = {};
    try {
        ourState = JSON.parse(ourStateRaw);
    } catch (e) {
        console.error("Unable to parse our saved state:", e, ", flushing. State was:", ourStateRaw);
        localStorage.removeItem(STATE_KEY)
    }
    if (typeof(ourState) != "object") {
        console.error("Unable to parse our saved state (not an object), flushing. State was:", ourState);
        ourState = {};
    }
    console.log("Found saved state:", ourState);
    return ourState;
}

function saveOurState(val) {
    console.log("Saving ritual engine state to local storage.")
    if (typeof(val) != "object") {
        console.error("Refusing to save our state (not an object):", val);
        return;
    }
    localStorage.setItem(STATE_KEY, JSON.stringify(val));
    // This is not great, it's kind of gross and abstraction-violating, but it gets the job done.
    if ($('#delete-cached-button')) {
        $('#delete-cached-button').prop('disabled', false).removeClass('footer-button-disabled');
    }
}

export function wipeClearableParameters() {
    var ourState = getOurState();
    console.log("Deleting clearable ritual engine state from local storage.")
    for (var k in ourState) {
        if (ourState[k].clearable) {
            delete ourState[k];
        }
    }
    saveOurState(ourState);
}

export function haveClearableParameters() {
    var ourState = getOurState();
    console.log("ourState", ourState);
    for (var k in ourState) {
        if (ourState[k].clearable) {
            return true;
        }
    }
    return false;
}

export function deleteParameter(key) {
    console.log("Deleting saved parameter:", key)
    var ourState = getOurState();
    delete ourState[key];
    saveOurState(ourState);
}

export function persistParameter(key, val, options) {
    if (options === undefined) {
        options = {};
    }
    var { clearable, timeout } = options;
    console.log("Persisting parameter:", key, " -> ", val, "for max seconds:", timeout, "clearable?:", clearable);
    var expiration;
    if (timeout === undefined) {
        expiration = null;
    } else {
        var now = Date.now() / 1000;
        expiration = now + timeout;
    }
    if (clearable === undefined) {
        clearable = true;  // default
    }
    console.log("Persisted parameter will expire at", expiration);
    var ourState = getOurState();
    ourState[key] = {
        val,
        expiration,
        clearable
    };
    saveOurState(ourState);
}

export function retrieveParameter(key) {
    console.log("Retrieving parameter:", key);
    var ourState = getOurState();
    if (key in ourState) {
        try {
            var rawVal = ourState[key];
            var { val, expiration, clearable } = rawVal;
            if (val === undefined) {
                throw new Error("bad stored data");
            }
        } catch (e) {
            console.error("Failed to parse saved parameter", key, "with raw value", rawVal, "because of exception", e);
            deleteParameter(key);
            return null;
        }
        console.log("Found parameter", key, "with value", val, "and expiration", expiration);
        var now = Date.now() / 1000;
        if (expiration !== null && now > expiration) {
            console.log("... but it was expired, throwing it out.");
            deleteParameter(key);
            return null;
        }
        // Caller must refresh expiration if desired, we don't do that here
        return val;
    }
    return null;
}

export async function wrappedFetch(resource, init, long) {
    let cancelConnectivityError = null;
    let response = null;
    let duration = 1;
    while (!(response = await fetch(resource, init).catch(() => null))) {
        if (cancelConnectivityError) {
            cancelConnectivityError();
        }
        cancelConnectivityError = warnUserAboutError();
        await new Promise((resolve) => {
            setTimeout(resolve, duration);
        });
        duration *= 2;
        if (long) {
            cancelConnectivityError();
            cancelConnectivityError = null;
        }
    }
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    if (cancelConnectivityError) {
        cancelConnectivityError();
    }
    return response;
}

let errorTimeoutHandle = null;
let cancelFuncs = new Set();
export function warnUserAboutError() {
    $('#error').show();
    if (errorTimeoutHandle) {
        clearTimeout(errorTimeoutHandle);
        errorTimeoutHandle = null;
    }
    function cancelFunc() {
        cancelFuncs.delete(cancelFunc);
        if (!cancelFuncs.size && !errorTimeoutHandle) {
            errorTimeoutHandle = setTimeout(() => {
                $('#error').hide(1000);
                errorTimeoutHandle = null;
            }, 5000);
        }
    }
    cancelFuncs.add(cancelFunc);
    return cancelFunc;
}

export function showHideCapBtn(videoElem) {
    let showCap = retrieveParameter('showCaptions');
    videoElem.textTracks[0].mode = showCap ? 'showing' : 'hidden';
    let button = $('<input type=button class="footer-button">').appendTo($('#widget-extra-ctrls'));
    button.val(showCap ? 'Hide captions' : 'Show captions')
          .on('click', (ev) => {
              let showCaptions = !retrieveParameter('showCaptions');
              persistParameter('showCaptions', showCaptions, {clearable: false});
              ev.target.value = (showCaptions ? 'Hide captions' : 'Show captions');
              videoElem.textTracks[0].mode = showCaptions ? 'showing' : 'hidden';
          });
    return button;
}
