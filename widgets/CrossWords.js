//TODO: make library function
function putOnBox(elem, color) {
    let box = $('path[stroke="'+color+'"]')
    let rect = box[0].getBoundingClientRect();
    box.hide();
    elem.css('position','absolute');
    for (let i of ['top','left','width','height']) {
        elem.css(i,rect[i]);
    }
}    

class CrossWords {
    constructor({boxColors, data}) {
        this.input = $('<input>').appendTo($('body'));
        putOnBox(this.input, boxColors.input);
        this.input.on('keyup', (ev) => {
            if (ev.which==13) {
                let name = this.input.val();
                $.post('widgetData', {name});
            }
        });
        this.tableElem = $('<table cellspacing=0 class=cw>').appendTo($('body'));
        putOnBox(this.tableElem, boxColors.content);
        this.table = [];
        for (let row of data) {
            let tr = $('<tr>').appendTo(this.tableElem);
            let trd = [];
            this.table.push(trd);
            for (let cell of row) {
                let td = $('<td>').attr('width',(100/data[0].length)+'%')
                                  .appendTo(tr);
                td.set = false;
                trd.push(td);
            }
        }
        $('<style>').text("table.cw {" +
                          "  background: rgba(0,0,0,0.5); "+
                          "} "+
                          "table.cw td { " +
                          "  font-size: " + (0.9*this.tableElem.height()/data.length)+"px; " +
                          "  text-align: center; " +
                          "  white-space: pre; " +
                          "  padding: 0; " +
                          "  font-weight: bold; " +
                          "  position: relative; " +
                          "}")
                    .appendTo($('head'));

        console.log(this.table);
    }
    
    from_server({data}) {
        for (let i in data) {
            for (let j in data[i]) {
                let datum = data[i][j];
                let td = this.table[i][j];
                td.css('color',datum.c);
                td.text(datum.t);
                if ( ! td.set && datum.t!=' ') {
                    td.css('text-shadow','0 0 1px white');
                    td.css('transform', 'scale(2)');
                    window.setTimeout(()=>td.css('text-shadow','unset').css('transform','scale(1.9)'), 200);
                    for (let t=1; t<5; t++) {
                        window.setTimeout(()=>td.css('transform','scale(1.'+(9-t)+')'), 200+30*t);
                    }
                    td.set = true;
                }
            }
        }
    }

    destroy() {
        this.tableElem.remove();
        this.input.remove();
    }
}

widgetClasses.CrossWords = CrossWords;
