let sq = (x) => (x*x);

const pi = Math.PI;

export class CircleFlames {
    constructor({victims, flames}) {
        $('#participants').hide();
        $('#content').css({ top: (window.innerHeight-$('svg').height())/2+'px',
                            position: 'relative' });
        
        this.div = $('<div>').css({position:'absolute',width:'100vw',height:'100vh',top:0}).appendTo($('body'));
        
        const text = $('text')
        const c = text[0].getBoundingClientRect();
        const cx = c.left + c.width/2;
        const cy = c.top + c.height/2;
        const inner = c.width/3;
        const outer = Math.min(window.innerWidth, window.innerHeight) * 0.4;
        const w = (outer - inner) / 2;

        /*
        $('<div>').css({ position: 'absolute',
                         top: (cy-outer)+'px',
                         left: (cx-outer)+'px',
                         width: (2*outer)+'px',
                         height: (2*outer)+'px',
                         border: '1px white solid',
                         borderRadius: outer+'px' })
                  .appendTo(this.div);
        */
        
        let theta = 0;
        let dtheta = 2*pi / victims.length;
        for (let v of victims) {
            let r = Math.random() * w + inner;
            theta += 2*Math.random() * dtheta;
            let x = Math.round(cx + r * Math.cos(theta) * 16/9 - w/2);
            let y = Math.round(cy + r * Math.sin(theta));
            $('<div>').css({ position: 'absolute',
                             top: y+'px',
                             left: x+'px',
                             width: w+'px',
                             transform: 'rotate(' + theta + 'rad)',
                             transformOrigin: 'top',
                             maxHeight: '5em',
                             fontSize: '9pt',
                             overflow: 'hidden',
                             color: 'white',
                             textShadow: '-1px -1px 0 black, 1px 1px 0 black',
                             background: 'rgba(0,0,0,0.4)',
                             opacity: 0 })
                      .text(v)
                      .animate({ opacity: 1}, 1000 * sq(r/inner) * (0.8+Math.random()*0.4))
                      .appendTo(this.div);
        }

        console.log(flames);
        const thb = Math.atan(cy/cx);
        for (let i=0; i<(200/flames.length); i++) {
            for (let f of flames) {
                let theta = Math.random() * pi * 2;
                let x,y;
                if (theta<thb || theta>(2*pi-thb)) {
                    x = 2*cx+100;
                    y = cy + cx * Math.tan(theta);
                } else if (theta < pi - thb) {
                    x = cx + cy / Math.tan(theta);
                    y = 2*cy+200;
                } else if (theta < thb + pi) {
                    x = -100;
                    y = cy - cx * Math.tan(theta);
                } else {
                    x = cx - cy / Math.tan(theta);
                    y = -100;
                }
                let dx = cx + outer * Math.cos(theta) * Math.sqrt(4/3) * (Math.random()+1) - 50;
                let dy = cy + outer * Math.sin(theta) * 3/4;
                console.log({f,x,y,dx,dy,theta});
                $('<div>').css({ background: 'url("img/'+f+'.jpg")',
                                 backgroundSize: 'contain',
                                 backgroundRepeat: 'no-repeat',
                                 backgroundPosition:'center',
                                 left: x+'px',
                                 top: y+'px',
                                 width: '100px',
                                 height: '100px',
                                 position: 'absolute',
                                 transform: 'rotate('+(theta-pi/2)+'rad)' ,
                                 transformOrigin: 'top' })
                          .animate( { left: dx+'px', top: dy+'px' }, 10*1000)
                          .appendTo(this.div);
            }
        }

       setTimeout(()=>{ $.post('widgetData'); }, 9*1000);
    }

    from_server(data) {}

    destroy() {
        this.div.remove();
        $('#participants').show();
        $('#content').css({top: 0, position:''});
    }
}
