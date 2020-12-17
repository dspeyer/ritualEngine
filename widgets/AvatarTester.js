import { putOnBox } from '../../lib.js';
import { rotateAvatars } from '../../avatars.js';

export class AvatarTester {
    constructor({boxColor}) {
        this.btn = $('<input type=button value="Rotate">').appendTo($('body'));
        putOnBox(this.btn, boxColor);
        this.btn.on('click', rotateAvatars);
    }
    async from_server() {}
    destroy() {
        this.btn.remove();
    }
}
    
