import { putOnBox } from '../../lib.js';

export class WelcomeWatch {
    constructor({boxColor}) {
        this.div = $('<div>').appendTo($('body'));
        putOnBox(this.div, boxColor);
    }
    from_server({n}) {
        this.div.text(n+' clients being welcomed');
    }
    destroy() {
        this.div.remove();
    }
}
