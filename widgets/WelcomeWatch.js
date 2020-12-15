import { putOnBox } from '../../lib.js';

export class WelcomeWatch {
    constructor({boxColor}) {
        this.div = $('<div>').appendTo($('body'));
        putOnBox(this.div, boxColor);
        this.clientWatch = $('<div class="client-watch">').appendTo($(this.div));
    }
    from_server({n}) {
        this.clientWatch.text(n+' clients being welcomed');
    }
    destroy() {
        this.div.remove();
    }
}
