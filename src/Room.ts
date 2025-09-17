import { EnterRoomAllowed, Madoi, PeerEntered, PeerLeaved, ShareClass, UserMessageArrived, type EnterRoomAllowedDetail, type PeerEnteredDetail, type PeerLeavedDetail, type UserMessageDetail } from "madoi-client";
import { CauseStateChange } from "madoi-client-react";
import { Peer, type WebRtcSignal } from "./Peer";
import { TypedCustomEventTarget, type TypedCustomEventListenerOrObject } from "tcet";

export type NewPeerArrivedListenerOrObject = TypedCustomEventListenerOrObject<Room, Peer>;

@ShareClass({className: "Room"})
export class Room extends TypedCustomEventTarget<Room, {
  newPeer: Peer;
}>{
  private _peers: Peer[] = [];

  get peers(){
    return this._peers;
  }

  /**
   * メディアストリームを追加する。
   * メディアストリームから得られる情報(音声・映像)は、既存の参加者や新規の参加者に送信される。
   * @param stream 
   */
  addStream(stream: MediaStream){
    this._peers.forEach(p=>p.addStream(stream));
  }

  /**
   * メディアストリームをクリアする。
   * 他の参加者への送信は停止される。
   */
  clearStream(){
    this._peers.forEach(p=>p.clearStream())
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
      const peer = this.newPeer(p.id, true, madoi);
      peer.startOffer();
      this._peers.push(peer);
    });
  }

  /**
   * ルーム参加後に、新たに参加者が来た際に呼び出されるメソッド。
   */
  @PeerEntered()
  protected onPeerEntered({peer}: PeerEnteredDetail, madoi: Madoi){
    console.log("[Room.onPeerEntered]", peer.id);
    // 新しい参加者が来れば、peerオブジェクトを作成して_peers配列に追加しておく。
    const p = this.newPeer(peer.id, false, madoi);
    this._peers.push(p);
  }

  @PeerLeaved()
  protected onPeerLeaved({peerId}: PeerLeavedDetail){
    console.log("[Room.onPeerLeaved]", peerId);
    //  参加者が退室すれば、_peers配列から削除しておく。
    this._peers = this._peers.filter(p=>p.id!==peerId);
  }

  /**
   * シグナルを受け取るメソッド。
   */
  @UserMessageArrived({type: "webRtcSignal"})
  @CauseStateChange(false)
  protected async onWebRtcSignalReceived(
      {sender, content}: UserMessageDetail<WebRtcSignal>){
    console.log("[Room.onWebRtcSignalReceived]", sender, content?.type);
    // 送信元に対応するPeerに渡す。
    this.getPeer(sender!).receiveSignal(content);
  }

  /**
   * ピアを作成するメソッド
   */
  private newPeer(peerId: string, polite: boolean, madoi: Madoi){
    console.log("[Room.newPeer]", peerId);
    const ret = new Peer(peerId, polite);
    // Peerからシグナル送信が要求されれば、Madoiで送る。
    ret.addEventListener("sendSignalNeeded", ({detail: {peerId, content}})=>{
      console.log("[Room.onSendSignalNeeded] send signal", content?.type);
      madoi.unicast("webRtcSignal", content, peerId);
    });
    // Peerが作成されたことを通知。
    this.dispatchCustomEvent("newPeer", ret);
    return ret;
  }

  /**
   * ピアの配列から指定のピアを探すメソッド
   */
  private getPeer(peerId: string){
    const ret = this._peers.find(p=>p.id===peerId);
    if(!ret) throw new Error(`peer not found. ${peerId}`);
    return ret;
  }
}
