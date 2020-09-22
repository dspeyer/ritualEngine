import { putOnBox } from '../../lib.js';

export class Trivia {
    constructor({boxColors}) {
        let div = $('<div>');
        let ta = $('<textarea>').appendTo(div);
        let button = $('<input type="button" value="Post">').appendTo(div);
        div.css({display:'flex', 'flex-direction':'column'});
        ta.css('flex-grow',999);
        putOnBox(div, boxColors.controls);
        this.div = div;
        ta.on('click', ()=>{
            let txt = ta.val();
            $.post('widgetData', {txt});
        });
        this.content = $('<div>');
        putOnBox(this.content, boxColors.results);
        this.have = 0;
    }
    
    from_server(data) {
        for (let i=this.have; i<data.length; i++) {
            let datum = data[i];
            $('<div>').text(datum.txt)
                      .css({ background: datum.color,
                             opacity: 0,
                             width: datum.w,
                             left: 'calc( ( 100% - '+datum.w+' ) * '+datum.x+')',
                             top: (datum.y*100)+'%',
                             color: 'white',
                             'text-shadow': '0 0 1px black'})
                      .animate({opacity: 0.8}, 0.5)
                      .appendTo(this.content);
        }
        this.have = data.length;
    }

    destroy() {
        this.content.remove();
        this.div.remove();
    }
}

