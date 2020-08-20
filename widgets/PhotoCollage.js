function dbg(txt) {
    $('<div>').text(txt).css('color','white').appendTo($('body'));
}

class PhotoCollage {
    constructor({boxcolor}) {
        let box = $('path[stroke="'+boxcolor+'"]');
        let rect = box[0].getBoundingClientRect();
        box.hide();
        this.div = $('<div>').css('position','absolute');
        for (let i of ['top','left','width','height']) {
            this.div.css(i,rect[i]);
        }
        $('body').append(this.div);
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
        let stream = await navigator.mediaDevices.getUserMedia({ video: true });
        let settings = stream.getVideoTracks()[0].getSettings();
        let {width,height} = settings;
        if (width>height && window.innerWidth<window.innerHeight) {
            // Probable browser bug in video dimension handling
            [width,height] = [height,width];
        }
        let w,h,l,t;
        dbg('settings(width='+width+',height='+height+') div(width='+this.div.width()+',height='+this.div.height()+')');
        if (width/height > this.div.width()/this.div.height()) {
            w = this.div.width();
            h = this.div.width() * height / width;
            t = (this.div.height() - h) / 2;
            l = 0;
            dbg('horiz setup: w='+w+' h='+h);
        } else {
            h = this.div.height();
            w = this.div.height() * width / height;
            l = (this.div.width() - w) / 2;
            t = 0;
            dbg('vert setup: w='+w+' h='+h);
        }
        let video = $('<video>').
            css('position','absolute').
            css('width',w+'px').
            css('height',h+'px').
            css('left',l+'px').
            css('top',t+'px').
            css('z-index',999).
            appendTo(this.div);
        video[0].srcObject = stream;
        video[0].play();
        let button = $('<input type="button" value="Take">').
            css('position','absolute').
            css('bottom','0').
            css('left','40%').
            css('right','40%').
            css('padding','2em').
            css('z-index','1000').
            appendTo(this.div);
        button.click(async ()=>{
            dbg('w='+w+' h='+h);
            let canvas = $('<canvas width='+w+' height='+h+'>').appendTo($('body'));
            let context = canvas[0].getContext('2d');
            context.drawImage(video[0], 0, 0, w, h);
            canvas[0].toBlob((blob)=>{
                let fd = new FormData();
                fd.append('img', blob);
                $.ajax({
                    type: 'POST',
                    url: 'widgetData',
                    data: fd,
                    processData: false,
                    contentType: false
                });
            }, 'image/jpeg');
            canvas.remove();
            video.remove();
            button.remove();
        });
    }
    from_server(data) {
        for (let i in data.imgs) {
            if (i >= this.imgs.length) {
                this.imgs.push( $('<div>')
                                .css('background-image','url(img/'+data.imgs[i].imgid+'.jpg)')
                                .css('background-size','contain')
                                .css('background-repeat','no-repeat')
                                .css('background-position','center')
                                .css('position','absolute')
                                .css('width','100%')
                                .css('height','100%')
                                .css('left','0')
                                .css('right','0')
                                .appendTo(this.div) );
            }
            if (data.imgs[i].size != this.imgs[i].logisize) {
                // TODO: animation
                this.imgs[i].animate( {'width': 95*data.imgs[i].size/data.gridsize+'%',
                                       'height': 95*data.imgs[i].size/data.gridsize+'%',
                                       'left': 100*data.imgs[i].x/data.gridsize+'%',
                                       'top': 100*data.imgs[i].y/data.gridsize+'%'},
                                      2000/*ms*/);
                this.imgs[i].logisize = data.imgs[i].size;
            }
        }
        
    }
    destroy() {
        this.div.remove();
    }
}

widgetClasses.PhotoCollage = PhotoCollage;
