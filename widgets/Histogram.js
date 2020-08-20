function putOnBox(elem, color) {
    let box = $('path[stroke="'+color+'"]')
    let rect = box[0].getBoundingClientRect();
    box.hide();
    for (let i of ['top','left','width','height']) {
        elem.css(i,rect[i]);
    }
}    

class Histogram {
    constructor({boxColors}) {
        this.input = $('<input type="number">').css('position','absolute').appendTo($('body'));
        putOnBox(this.input, boxColors.input);
        this.content = $('<div>').css('position','absolute')
                                 .css('border-bottom','1px white solid')
                                 .appendTo($('body'));
        putOnBox(this.content, boxColors.result);
        this.hr = this.content.width() / this.content.height();
        this.imgs = [];
        this.xaxes = [];
        this.input.on('keyup', (ev)=>{
            if (ev.which == 13) {
                let x = this.input.val();
                let fd = new FormData();
                fd.append('x', x);
                $.ajax({
                    type: 'POST',
                    url: 'widgetData',
                    data: fd,
                    processData: false,
                    contentType: false
                });
            }
        });
    }
    
    from_server(data) {
        for (let i in data.imgs) {
            if (i >= this.imgs.length) {
                this.imgs.push( $('<div>')
                                .css('background-image','url(img/'+data.imgs[i].imgId+'.jpg)')
                                .css('background-size','contain')
                                .css('background-repeat','no-repeat')
                                .css('background-position','center')
                                .css('position','absolute')
                                .css('width', data.imgs[i].w+'%')
                                .css('height', (data.imgs[i].h*this.hr)+'%')
                                .css('left', data.imgs[i].x+'%')
                                .css('bottom','100%')
                                .css('border','1px solid rgba(0,255,255,0.3)')
                                .appendTo(this.content) );
            }
            this.imgs[i].animate( {'left': data.imgs[i].x+'%',
                                   'bottom': (data.imgs[i].y*this.hr)+'%' },
                                  2000 /*ms*/ );
        }
        for (let i of this.xaxes) {
            i.remove();
        }
        this.xaxes = [];
        for (let i of data.xaxes) {
            this.xaxes.push( $('<div>')
                             .text(i.v)
                             .css('position','absolute')
                             .css('left', i.x+'%')
                             .css('top','100%')
                             .css('color','#aaa')
                             .css('padding-top','5px')
                             .css('border-left', '1px solid white') 
                             .appendTo(this.content) );
        }
    }
    destroy() {
        this.content.remove();
        this.input.remove();
    }
}

widgetClasses.Histogram = Histogram;
