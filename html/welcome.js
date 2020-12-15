let track = null;
async function setVid(video) {
    if (track) {
        track.stop();
    }
    try {
        track = await Twilio.Video.createLocalVideoTrack({width:100, height:100, deviceId:{exact:cameraChoice[0]}});
        track.attach(video[0]);
    } catch (e) {
        console.log(e);
    }
}

let inprog = false;
export async function  welcome(widgets) {
    if (inprog) return;
    inprog = true;
    let dlg = $('<div class=modaldlg>').appendTo($('body'));
    dlg.append($(`<div id="askname">
                    <h1>Welcome</h1>
                    Please give us a name to call you.  This will be visible to the other participants.
                    <input id="name">
                    <input type="button" id="sendname" value="OK">
                  </div>`));
    let res;
    let p = new Promise((r)=>{res=r;});
    $('#sendname').on('click',res);
    $('#name').on('keyup', (ev)=>{ if (ev.key=='Enter') res(); });
    await p;

    let name = $('#name').val();
    // TODO: sanity-check name
    $.post('setName', {clientId, name});
    chatname[0] = name;

    dlg.empty();
    dlg.append($('<p>We like to show all ritual participants to each other, '+
                 'using a mixture of video feeds and still images...</p>'));
    try {
        // Force a permissions dialog before calling enumerateDevices, but ignore any trouble because this isn't the place
        track = await Twilio.Video.createLocalVideoTrack({width:100, height:100});
        track.stop();
    } catch (e) {}
    let devices = await navigator.mediaDevices.enumerateDevices();
    devices = devices.filter((x)=>(x.kind=='videoinput'));
    p = new Promise((r)=>{res=r;});
    if (devices.length >= 1) {
        let choice = 0;
        cameraChoice[0] = devices[0].deviceId;
        dlg.append($('<p>Your video feed looks like this:</p>'));
        let video = $('<video>').css({borderRadius:'50%',
                                      border:'2px solid #999',
                                      marginLeft:'calc(50% - 51px)',
                                      width:'100px',
                                      height:'100px'}).appendTo(dlg);
        await setVid(video);
        $('<input type=button value="Looks good">').on('click',res).appendTo(dlg);
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
        if (track) {
            track.stop();
        }
        dlg.empty();
    } else {
        cameraChoice[0] = null;
    }

    if ( ! cameraChoice[0]) {
        p = new Promise((r)=>{res=r;});
        $('<p>In lieu of a webcam, would you like to upload a static avatar?</p>').appendTo(dlg);
        $('<input id=avatarfile type=file>').on('change',()=>{$('#sendav').attr('disabled',false);})
                                            .appendTo(dlg);
        $('<input id=sendav type=button disabled=true value="Upload this file">').on('click', ()=>{
            let blob = $('#avatarfile')[0].files[0];
            let fd = new FormData();
            fd.append('img', blob);
            $.ajax({
                type: 'POST',
                url: 'clientAvatar/'+clientId,
                data: fd,
                processData: false,
                contentType: false
            });
            res();
        }).appendTo(dlg);
        $('<input type=button value="No, I\'ll just use the default">').on('click',res).appendTo(dlg);
        if (devices.length == 0) {
            $("<p>(If you <i>have</i> a webcam, double-check that it's plugged in and reload this page)</p>").css({fontSize:'smaller'}).appendTo(dlg);
        }
        await p;
    }
    
    dlg.remove();
    for (let widget of widgets) {
        let module = await import('/widgets/'+widget+'.js');
        await module.welcome();
    }
    $.post('welcomed/'+clientId);
}
