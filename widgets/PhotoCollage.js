import { putOnBox, getPhoto } from '../../lib.js';

function dbg(txt) {
//    $('<div>').text(txt).css('color','white').appendTo($('body'));
}

export class PhotoCollage {
    constructor({boxcolor}) {
        this.div = $('<div>').appendTo($('body'));
        putOnBox(this.div, boxcolor);
        this.imgs = [];
        navigator.mediaDevices.enumerateDevices().then((list)=>{
            if (list.filter( (dev)=>(dev.kind=='videoinput') ).length) {
                let button = $('<input type="button" value="Take Photo">');
                button.css('position','absolute').css('top','-1em').appendTo(this.div);
                button.click(this.getPhoto.bind(this));
            }
        });
    }
    async getPhoto() {
        let blob = await getPhoto(this.div, 'blob');
        let fd = new FormData();
        fd.append('img', blob);
        $.ajax({
            type: 'POST',
            url: 'widgetData',
            data: fd,
            processData: false,
            contentType: false
        });
    }
    from_server(data) {
        for (let i in data.imgs) {
            if (i >= this.imgs.length) {
                let {r,g,b,imgid,theta} = data.imgs[i];
                let grad = ( 'radial-gradient(' +
                             'rgba('+r+','+g+','+b+',0.3) 0%, '+
                             'rgba('+r+','+g+','+b+',0.5) 70%, '+
                             'rgba('+r/2+','+g/2+','+b/2+',0.5) 85%, '+
                             'black 95%), ');
                this.imgs.push( $('<div>')
                                .css('background-image',grad+'url(img/'+imgid+'.jpg)')
                                .css('background-size','contain')
                                .css('background-repeat','no-repeat')
                                .css('background-position','center')
                                .css('position','absolute')
                                .css('width','100%')
                                .css('height','100%')
                                .css('left','0')
                                .css('right','0')
                                .css('transform','rotate('+theta+'deg)')
                                .appendTo(this.div) );
            }
            if (data.imgs[i].size != this.imgs[i].logisize) {
                // TODO: animation
                this.imgs[i].animate( {'width': 95*data.imgs[i].size*data.imgs[i].sm/data.gridsize+'%',
                                       'height': 95*data.imgs[i].size*data.imgs[i].sm/data.gridsize+'%',
                                       'left': 100*data.imgs[i].y/data.gridsize+'%',
                                       'top': 100*data.imgs[i].x/data.gridsize+'%'},
                                      2000/*ms*/);
                this.imgs[i].logisize = data.imgs[i].size;
            }
        }
        
    }
    destroy() {
        this.div.remove();
    }
}

