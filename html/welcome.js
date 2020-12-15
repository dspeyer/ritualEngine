let inprog = false;
export async function  welcome() {
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

    dlg.remove();
    if (state.welcome) {
        await state.welcome();
    } 
    $.post('welcomed/'+clientId);
}
