import { EnterRoomAllowed, Madoi, PeerEntered, PeerLeaved, ShareClass, UserMessageArrived, type EnterRoomAllowedDetail, type PeerEnteredDetail, type PeerLeavedDetail, type UserMessageDetail } from "madoi-client";
import { CauseStateChange } from "madoi-client-react";
import { Peer, type WebRtcSignal } from "./Peer";
import { TypedCustomEventTarget, type TypedCustomEventListenerOrObject } from "tcet";

export type NewPeerArrivedListenerOrObject = TypedCustomEventListenerOrObject<Room, Peer>;

@ShareClass({className: "Room"})
export class Room extends TypedCustomEventTarget<Room, {
  newPeer: Peer;
}>{
  private rtcPeers: Peer[] = [];

  get peers(){
    return this.rtcPeers;
  }

  /**
   * メディアストリームを追加する。
   * メディアストリームから得られる情報(音声・映像)は、既存の参加者や新規の参加者に送信される。
   * @param stream 
   */
  addStream(stream: MediaStream){
    this.peers.forEach(p=>p.addStream(stream));
  }

  /**
   * メディアストリームをクリアする。
   * 他の参加者への送信は停止される。
   */
  clearStream(){
    this.peers.forEach(p=>p.clearStream())
  }

  /**
   * ルームに参加した際に呼び出されるメソッド。
   * 既存参加者とのWebRTC接続を開始する。
   * @param param0 
   * @param madoi 
   */
  @EnterRoomAllowed()
  protected onEnterRoomAllowed({otherPeers}: EnterRoomAllowedDetail, madoi: Madoi){
    console.log("[Room.onEnterRoomAllowed]", otherPeers);
    otherPeers.forEach(p=>{
      const rtcPeer = this.newPeer(p.id, true, madoi);
      rtcPeer.startOffer();
      this.rtcPeers.push(rtcPeer);
    });
  }

  /**
   * ルーム参加後に、新たに参加者が来た際に呼び出されるメソッド。
   * 
   * @param param0 
   * @param madoi 
   */
  @PeerEntered()
  protected onPeerEntered({peer}: PeerEnteredDetail, madoi: Madoi){
    console.log("[Room.onPeerEntered]", peer.id);
    // 新しい参加者が来れば、RtcPeerオブジェクトを作成してrtcPeers配列に追加しておく。
    const rtcPeer = this.newPeer(peer.id, false, madoi);
    this.rtcPeers.push(rtcPeer);
  }

  @PeerLeaved()
  protected onPeerLeaved({peerId}: PeerLeavedDetail){
    console.log("[Room.onPeerLeaved]", peerId);
    //  参加者が退室すれば、rtcPeers配列から削除しておく。
    this.rtcPeers = this.rtcPeers.filter(p=>p.id!==peerId);
  }

  /**
   * シグナルが届けば、対応するRtcPeerに渡す。
   * @param param0 
   */
  @UserMessageArrived({type: "webRtcSignal"})
  @CauseStateChange(false)
  protected async onWebRtcSignalReceived(
      {sender, content}: UserMessageDetail<WebRtcSignal>){
    console.log("[Room.onWebRtcSignalReceived]", sender, content?.type);
    this.getPeer(sender!).receiveSignal(content);
  }

  /**
   * ピアを作成するメソッド
   */
  private newPeer(peerId: string, polite: boolean, madoi: Madoi){
    console.log("[Room.newPeer]", peerId);
    const ret = new Peer(peerId, polite);
    // RtcPeerからシグナル送信が要求されれば、Madoiで送る。
    ret.addEventListener("sendSignalNeeded", ({detail: {peerId, content}})=>{
      console.log("[Room.onSendSignalNeeded] send signal", content?.type);
      madoi.unicast("webRtcSignal", content, peerId);
    });
    this.dispatchCustomEvent("newPeer", ret);
    return ret;
  }

  /**
   * ピアの配列から指定のピアを探すメソッド
   */
  private getPeer(peerId: string){
    const ret = this.rtcPeers.find(p=>p.id===peerId);
    if(!ret) throw new Error(`peer not found. ${peerId}`);
    return ret;
  }
}
