import { putOnBox } from '../../lib.js';

export class Trivia {
    constructor({boxColors}) {
        let div = $('<div>').appendTo($('body'));
        let ta = $('<textarea>').appendTo(div);
        let button = $('<input type="button" value="Post">').appendTo(div);
        div.css({display:'flex', 'flex-direction':'column'});
        ta.css('flex-grow',999);
        putOnBox(div, boxColors.controls);
        this.div = div;
        button.on('click', ()=>{
            let txt = ta.val();
            $.post('widgetData', {txt});
        });
        this.content = $('<div>').appendTo($('body'));
        putOnBox(this.content, boxColors.results);
        this.have = 0;
    }
    
    from_server({data}) {
        for (let i=this.have; i<data.length; i++) {
            let datum = data[i];
            console.log(datum);
            $('<div>').text(datum.t)
                      .css({ position: 'absolute',
                             background: datum.color,
                             opacity: 0,
                             width: datum.w,
                             left: 'calc( ( 100% - '+datum.w+' ) * '+datum.x+')',
                             top: (datum.y*100)+'%',
                             color: 'white',
                             'text-shadow': '0 0 1px black' })
                      .animate({opacity: 0.8}, 500/*ms*/)
                      .appendTo(this.content);
        }
        this.have = data.length;
    }

    destroy() {
        this.content.remove();
        this.div.remove();
    }
}

