import { putOnBox } from '../../lib.js';

export class Video {
  constructor({boxColor, videoUrl}) {
    console.log("ASFASFASDF", videoUrl)
    this.video_div = $('<div class="speaker-video">').css('z-index',-1).appendTo($('body'));
    putOnBox([this.video_div], boxColor);
    this.video = $(`video[src='${videoUrl}']`);
    this.video.removeClass('hidden').appendTo(this.video_div);
    this.video.animate({opacity: 1}, 500);
    let videoElem = this.video[0];
    videoElem.play();
  }
  
  async from_server() {}
  
  destroy(){
    this.video.removeClass('bbs-video').addClass('hidden').appendTo(document.body);
    this.video_div.remove();
  }
  
}
