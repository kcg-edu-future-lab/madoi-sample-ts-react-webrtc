import { TypedCustomEventTarget, type TypedCustomEventListenerOrObject } from "tcet";

// 型定義
export type WebRtcIceSignal = RTCIceCandidate | null;
export type WebRtcSignal = RTCSessionDescriptionInit | WebRtcIceSignal;
export interface SendSignalNeededDetail{
  peerId: string;
  content: WebRtcSignal;
}
export interface TrackAddedDetail{
  peerId: string;
  streams: readonly MediaStream[];
};
export interface TrackRemovedDetail{
  peerId: string;
  track: MediaStreamTrack;
}
export type SendSignalNeededListenerOrObject = TypedCustomEventListenerOrObject<Peer, SendSignalNeededDetail>;
export type TrackAddedEventListenerOrObject = TypedCustomEventListenerOrObject<Peer, TrackAddedDetail>;
export type TrackRemovedEventListenerOrObject = TypedCustomEventListenerOrObject<Peer, TrackRemovedDetail>;

/**
 * WebRTCのピアに必要な処理を実装する。
 * 内部でRTCPeerConnectionを保持する。
 */
export class Peer extends TypedCustomEventTarget<Peer, {
  sendSignalNeeded: SendSignalNeededDetail;
  trackAdded: TrackAddedDetail;
  trackRemoved: TrackRemovedDetail;
}>{
  private _id: string;
  private _polite: boolean;
  private _con: RTCPeerConnection;

  constructor(id: string, polite: boolean){
    super();
    this._id = id;
    this._polite = polite;
    this._con = new RTCPeerConnection({"iceServers":[
      {'urls': 'stun:stun.l.google.com:19302'}
    ]});
    this._con.addEventListener("track", ({streams})=>{
      streams.forEach(s=>s.addEventListener("removetrack", ({track})=>{
        this.dispatchCustomEvent("trackRemoved", {peerId: this._id, track});
      }));
      this.dispatchCustomEvent("trackAdded", {peerId: this._id, streams});
    });
    this._con.addEventListener("icecandidate", ({candidate})=>{
      this.dispatchCustomEvent("sendSignalNeeded", {peerId: this._id, content: candidate});
    });
    this._con.addEventListener("icecandidateerror", error=>{
      console.error("[Peer.con.icecandidateerror]", error);
    });
    this._con.addEventListener("negotiationneeded", async ()=>{
      const offer = await this._con.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true});
      if(this._con.signalingState != "stable") return;
      await this._con.setLocalDescription(offer);
      this.dispatchCustomEvent("sendSignalNeeded",
        {peerId: this._id, content: offer});
    });
  }

  /**
   * ID。
   */
  get id(){
    return this._id;
  }

  /**
   * perfect negotiationにおけるpoliteフラグ。
   */
  get polite(){
    return this._polite;
  }

  /**
   * 入力用RTCPeerConnection。
   */
  get con(){
    return this._con;
  }

  /**
   * offerを開始する。
   * offerを作成してlocalDescriptionとしてRtcPeerConnectionにセットし、接続先への送信を要求する。
   */
  async startOffer(): Promise<void>{
    const offer = await this._con.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true});
    await this._con.setLocalDescription(offer);
    this.dispatchCustomEvent("sendSignalNeeded", {peerId: this._id, content: offer});
  }

  /**
   * signalを受け取った時に呼び出すメソッド。
   * typeに応じてoffer/answer/ice candidate用のメソッドを呼び出す。
   * @param signal
   */
  async receiveSignal(signal: WebRtcSignal): Promise<void>{
    if(signal?.type === "offer"){
      this.receiveOffer(signal);
    } else if(signal?.type === "answer"){
      this.receiveAnswer(signal);
    } else if(signal?.type === "pranswer" || signal?.type === "rollback"){
      console.error("[Peer.receiveSignal] unexpected signal", signal);
    } else{
      this.receiveIceCandidate(signal as WebRtcIceSignal);
    }
  }

  /**
   * ピアに送信するstreamを追加する。
   * @param stream 
   */
  addStream(stream: MediaStream){
    stream.getTracks().forEach(t=>this._con.addTrack(t, stream));
  }

  /**
   * ピアに送信するstreamをクリアする。
   */
  clearStream(){
    this._con.getSenders().forEach(s=>{
      this._con.removeTrack(s);
    });
  }

  /**
   * offerを受け取るメソッド。
   * RTCPeerConnectionにofferをセットし、answerを作成し、sendAnswerNeededイベントを発生させる。
   * perfect negotiation(https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation )
   * を実装。
   * @param offer 
   */
  private async receiveOffer(offer: RTCSessionDescriptionInit){
    if(this._con.signalingState !== "stable") {
      if(!this._polite) return;
      await Promise.all([
        this._con.setLocalDescription({ type: "rollback" }),
        this._con.setRemoteDescription(offer)
      ]);
    } else{
      await this._con.setRemoteDescription(offer);
    }
    const answer = await this._con.createAnswer({offerToReceiveAudio: true, offerToReceiveVideo: true});
    await this._con.setLocalDescription(answer);
    this.dispatchCustomEvent("sendSignalNeeded", {peerId: this._id, content: answer});
  }

  /**
   * answerを受け取るメソッド。
   * RTCPeerConnectionにanswerを設定する。
   * @param answer
   */
  private async receiveAnswer(answer: RTCSessionDescriptionInit): Promise<void>{
    await this._con.setRemoteDescription(answer);
  }

  /**
   * ice candidateを受け取るメソッド。
   * RTCPeerConnectionにcandidateを設定する。
   * @param candidate 
   */
  private async receiveIceCandidate(candidate: WebRtcIceSignal): Promise<void>{
    await this._con.addIceCandidate(candidate);
  }
}
