import { deleteParameter, retrieveParameter, persistParameter, wrappedFetch } from './lib.js'

let track = null;
async function setVid(video) {
    if (track) {
        track.stop();
    }
    try {
        track = await Twilio.Video.createLocalVideoTrack({width:100, height:100, deviceId:{exact:cameraChoice[0]}});
        track.attach(video[0]);
        return true;
    } catch (e) {
        track = null;
        console.log(e);
        return false;
    }
}

async function initVideo(dlg) {
    dlg.empty();
    dlg.append($('<p>We like to show all ritual participants to each other, '+
                 'using a mixture of video feeds and still images...</p>'));

    let checking = $('<p>Checking your camera...</p>').appendTo(dlg);

    try {
        // Force a permissions dialog before calling enumerateDevices, but ignore any trouble because this isn't the place
        track = await Twilio.Video.createLocalVideoTrack({width:100, height:100});
        track.stop();
    } catch (e) {}
    let devices = await navigator.mediaDevices.enumerateDevices();
    devices = devices.filter((x)=>(x.kind=='videoinput' && x.deviceId));

    let saved_devicelist = retrieveParameter("camera_choice_options");
    let saved_camera = retrieveParameter("camera_choice");

    let current_devicelist = JSON.stringify(devices.map((x) => x.deviceId));
    console.log("Current device list:", current_devicelist, "Saved device list:", saved_devicelist, "saved camera:", saved_camera);
    let saved_camera_ok = false;
    if (saved_devicelist == current_devicelist && saved_camera !== null) {
        console.log("All looks good, using saved camera");
        // ok to reuse existing selection if nothing has changed
        if (saved_camera == {}) {
            // Hack for selecting "no camera"
            saved_camera = null;
        }
        cameraChoice[0] = saved_camera;
        let video = $('<video>').appendTo(dlg);
        if (await setVid(video)) {
            dlg.empty();
            return true;
        }
    }

    console.log("Can't used saved camera, prompting...");
    checking.remove();
        
    let feednote, video;
    if (devices.length >= 1) {
        checking = $('<p>Checking camera'+(devices.length>1?'s':'')+'...</p>').appendTo(dlg);
        feednote = $('<p>Your video feed looks like this:</p>').appendTo(dlg);
        video = $('<video>').css({borderRadius:'50%',
                                  border:'2px solid #999',
                                  marginLeft:'calc(50% - 51px)',
                                  width:'100px',
                                  height:'100px'}).appendTo(dlg);
        let finishedok;
        for (let dev of devices) {
            cameraChoice[0] = devices[0].deviceId;
            finishedok = dev.ok = await setVid(video);
        }
        devices = devices.filter((x)=>(x.ok));
        if ( ! finishedok && devices.length) {
            cameraChoice[0] = devices[0].deviceId;
            await setVid(video);
        }
        checking.remove();
    }
    
    if (devices.length == 0) {
        if (feednote) feednote.remove();
        if (video) video.remove();
        cameraChoice[0] = null;
        return false;
    }

    let res;
    let p = new Promise((r)=>{res=r;});
    let choice = 0;
    $('<input type=button  class="yes-button" value="Looks good">').on('click',res).appendTo(dlg);
    if (devices.length > 1) {
        $('<input type=button value="Use other camera">').on('click',()=>{
            choice = (choice + 1) % devices.length;
            cameraChoice[0] = devices[choice].deviceId;
            setVid(video);
        }).appendTo(dlg);
    }
    $('<input type=button value="Don\'t show video">').on('click',()=>{ cameraChoice[0]=null; res(); })
                                                      .appendTo(dlg);
    if (devices.length == 1) {
        $(`<p>
             (Do you have multiple cameras?  If so, your browser is choosing which to let us access.  You can
             change this setting by clicking on the camera icon to the right of the URL.)
           </p>`).css({fontSize:'smaller'}).appendTo(dlg);
    }
    await p;
    dlg.empty();

    persistParameter("camera_choice_options", current_devicelist);
    if (cameraChoice[0] === null) {
        // hack to deal with null valules
        persistParameter("camera_choice", {});
    } else {
        persistParameter("camera_choice", cameraChoice[0]);
    }
    return true;
}


let inprog = false;
export async function welcome(widgets) {
    if (inprog) return;
    inprog = true;

    let name = retrieveParameter("chat_name");
    let dlg = $('<div class=modaldlg>').appendTo($('body'));

    if (name === null) {
        dlg.append($(`<div id="askname">
                    <h1>Welcome</h1>
                    <p>First, <b class="warning">please make sure you are using Google Chrome. <em>(<a class="warning" href="https://www.google.com/chrome">Download</a>)</em> </b> <br>Solstice will not reliably work on Firefox, Safari or other browsers.</p>
                    <p>Please give us a name to call you.  This will be visible to the other participants.</p>
                    <div class="name-input-row">
                        <input id="name">
                        <input type="button" id="sendname" value="OK">
                    </div>
                  </div>`));
        let res;
        let p = new Promise((r)=>{res=r;});
        $('#sendname').on('click',res);
        $('#name').on('keyup', (ev)=>{ if (ev.key=='Enter') res(); });
        await p;

        name = $('#name').val();
        persistParameter("chat_name", name);
    }
    // TODO: sanity-check name
    let body = new FormData();
    body.append('clientId', clientId);
    body.append('name', name);
    wrappedFetch('setName', {method: 'POST', body});
    chatname[0] = name;

    let hasAnyCamera = await initVideo(dlg);
    if (track) {
        track.stop();
    }
    
    if ( ! cameraChoice[0]) {
        let res;
        let p = new Promise((r)=>{res=r;});
        $('<p>In lieu of a webcam, would you like to upload a static avatar?</p>').appendTo(dlg);
        $('<input id=avatarfile type=file>').on('change',()=>{$('#sendav').attr('disabled',false);})
                                            .appendTo(dlg);
        $('<input id=sendav type=button disabled=true value="Upload this file">').on('click', ()=>{
            let blob = $('#avatarfile')[0].files[0];
            let fd = new FormData();
            fd.append('img', blob);
            wrappedFetch('clientAvatar/'+clientId, {method: 'POST', body: fd});
            res();
        }).appendTo(dlg);
        $('<input type=button value="No, I\'ll just use the default">').on('click',res).appendTo(dlg);
        if ( ! hasAnyCamera) {
            $("<p>(If you <i>have</i> a webcam, double-check that it's plugged in and not in use by another app, then reload this page)</p>").css({fontSize:'smaller'}).appendTo(dlg);
        }
        await p;
    }

    dlg.remove();
    for (let widget of widgets) {
        let module = await import('/widgets/'+widget+'.js');
        await module.welcome();
    }
    wrappedFetch('welcomed/'+clientId, {method: 'POST'});
}
