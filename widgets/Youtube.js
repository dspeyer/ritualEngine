import { putOnBox } from '../../lib.js';

export class Youtube {
    constructor(args) {
        this.real_constructor(args); // Don't worry about when it finishes
    }

    async real_constructor({boxColor, videoId}) {
        await window.youTubeReadyPromise;
        
        this.div = $('<div></div>').appendTo($('body'));
        putOnBox(this.div, boxColor);
        let backer = $('<div></div>').appendTo(this.div);
        $('<div style="opacity:0.7"><div id=ytplayer></div></div>').appendTo(this.div);
        console.log({YT});

        let w = this.div.width();
        let h = this.div.height();
        if (w > 16 / 9 * h) {
            w = 16 / 9 * h;
            this.div.width(w);
        } else {
            h = 9 / 16 * w;
            this.div.height(h);
        }
        w = Math.floor(w);
        h = Math.floor(h);
        let r = Math.min(h,w) / 5;
        this.div.css({borderRadius:r+'px', overflow: 'hidden'});
        backer.css({position:'absolute', top:r+'px', left:r+'px', bottom:0, right:r+'px',
                    zIndex:0, background:'#777', borderRadius:r+'px',
                    boxShadow: '0 0 '+r+'px #777, 0 0 '+r/2+'px #777, 0 0 '+r/10+'px #777'});
        
        console.log({h,w});
        
        this.player = new YT.Player('ytplayer', {
            height: h,
            width: w,
            videoId: videoId,
            events: {
                'onReady': (event)=>{console.log('ready etpv is '+typeof(event.target.playVideo)+' equality...'+(this.player===event.target));event.target.playVideo();},
                'onStateChange':(event)=>{
                    console.log('onStateChange',event)
                    if (event.data == YT.PlayerState.ENDED) {
                        this.div.hide();
                    }
                }
            }
        });
/*        console.log(this.player);
        await new Promise((res)=>{setTimeout(res,1200);});
        console.log(this.player);
        this.player.playVideo();*/
    }

    async from_server({}) {}
    
    destroy() {
        this.player.destroy();
        this.div.remove();
    }
}
