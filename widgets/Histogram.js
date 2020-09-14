import { putOnBox } from '../../lib.js';

export class Histogram {
    constructor({boxColors}) {
        this.page = 0;
        this.input = $('<input type="number">').appendTo($('body'));
        putOnBox(this.input, boxColors.input);
        this.content = $('<div>').css('border-bottom','1px white solid')
                                 .appendTo($('body'));
        putOnBox(this.content, boxColors.result);
        this.hr = this.content.width() / this.content.height();
        if (boxColors.turn) { // No longer used, but hide the box
            let readiness = $('<div>').appendTo($('body'));
            putOnBox(readiness, boxColors.turn);
        }
        this.imgs = [];
        this.xaxes = [];
        this.input.on('keyup', (ev)=>{
            if (ev.which == 13) {
                let x = this.input.val();
                $.post('widgetData', {x});
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
        this.page = data.imgs.length;
    }

    destroy() {
        this.content.remove();
        this.input.remove();
        this.readiness.remove();
    }
}

