export class Videoconference {
  constructor({ roomId, token }) {
    this.div = document.createElement('div');
    document.body.appendChild(this.div);
    this.roomPromise = Twilio.Video.connect(token, { name: roomId, audio: false, video: { width: 640 } }).then((room) => {
      for (let participant of room.participants.values()) {
        for (let { track } of participant.tracks.values()) {
          if (track) {
            this.show(track);
          }
        }
        participant.on('trackSubscribed', (track) => {
          this.show(track);
        });
      }
      room.on('participantConnected', (participant) => {
        for (let { isSubscribed, track } of participant.tracks.values()) {
          if (isSubscribed) {
            this.show(track);
          }
        }
        participant.on('trackSubscribed', (track) => {
          this.show(track);
        });
      });
      return room;
    });
  }

  show(track) {
    this.div.appendChild(track.attach());
  }

  async from_server() { }

  destroy() {
    this.div.remove();
    this.roomPromise.then((room) => {
      room.disconnect();
    })
  }
}
