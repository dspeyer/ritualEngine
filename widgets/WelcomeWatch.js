import { putOnBox } from '../../lib.js';

export class WelcomeWatch {
    constructor({boxColor}) {
        this.div = $('<div>').appendTo($('body'));
        putOnBox(this.div, boxColor);
        this.div.css({background: 'rgba(255,255,255,0.6)',
                      boxShadow: '0 0 5px white',
                      borderRadius: '10px',
                      textAlign: 'center',
                      paddingTop: this.div.height()/2 + 'px'});
    }
    from_server({n}) {
        this.div.text(n+' clients being welcomed');
    }
    destroy() {
        this.div.remove();
    }
}
