function putOnBox(elem, color) {
    let box = $('path[stroke="'+color+'"]')
    let rect = box[0].getBoundingClientRect();
    box.hide();
    elem.css('position','absolute');
    for (let i of ['top','left','width','height']) {
        elem.css(i,rect[i]);
    }
}    

class Histogram {
    constructor({boxColors}) {
        this.page = 0;
        this.input = $('<input type="number">').appendTo($('body'));
        putOnBox(this.input, boxColors.input);
        this.content = $('<div>').css('border-bottom','1px white solid')
                                 .appendTo($('body'));
        putOnBox(this.content, boxColors.result);
        this.hr = this.content.width() / this.content.height();
        this.readiness = $('<div>').css({ color:'#7cc', background:'rgba(0,0,0,0.5)', 'text-align':'right' })
                                   .appendTo($('body'));
        putOnBox(this.readiness, boxColors.turn);
        let initiative = Math.round(Math.random()*1e15); // Too big for birthday paradox, too small for FP trouble
        this.initiative = initiative
        $.post('widgetData', {initiative});
        this.imgs = [];
        this.xaxes = [];
        this.input.on('keyup', (ev)=>{
            if (ev.which == 13) {
                let x = this.input.val();
                $.post('widgetData', {x, initiative});
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
        let turn = data.initiatives.indexOf(this.initiative);
        if (turn==-1) {
            this.readiness.text('');
        } else if (turn==0) {
            this.readiness.text('It is your turn to tell');
        } else if (turn==1) {
            this.readiness.text("You're up next; be ready");
        } else {
            this.readiness.text("Your turn is in "+turn);
        }
        if (true) { // TODO: pick who has this power
            $('<input type=button value="Skip">').
                on('click',()=>{ $.post('widgetData',{initiative:data.initiatives[0],x:-9999}) }).
                appendTo(this.readiness);
        }
        this.page = data.initiatives.length;
    }

    destroy() {
        this.content.remove();
        this.input.remove();
        this.readiness.remove();
    }
}

widgetClasses.Histogram = Histogram;
