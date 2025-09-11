import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Madoi } from 'madoi-client';
import { RemoteVideo } from './RemoteVideo';
import { useSharedModel } from 'madoi-client-react';
import { Room, type NewPeerArrivedListenerOrObject } from './Room';

interface Props{
  madoi: Madoi;
}
export default function App({madoi}: Props) {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const room = useSharedModel(madoi, ()=>new Room());
	const localVideoRef = useRef<HTMLVideoElement>(null!);

  // 新しい参加者に対する処理。mediaStreamがあれば追加する。
  const onNewPeer: NewPeerArrivedListenerOrObject = ({detail: peer}) =>{
    if(mediaStream !== null) peer.addStream(mediaStream);
  }

  // start/stopボタンのクリックイベントのリスナ。
  const onStartMediaStreamClick = async ()=>{
    if(mediaStream === null){
      // まだmediaStreamが無ければ取得してRoomにも追加する。
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play();
      room.addStream(stream);
      setMediaStream(stream);
    } else{
      // mediaStreamが存在すれば停止してRoomからも削除する。
      (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
      localVideoRef.current.srcObject = null;
      room.clearStream();
      setMediaStream(null);
    }
  };

  useEffect(()=>{
    room.addEventListener("newPeer", onNewPeer);
    return ()=>{
      room.removeEventListener("newPeer", onNewPeer);
    };
  });

  return <>
    <div style={{border: "solid 1px", padding: "2px"}}>
      <video ref={localVideoRef} playsInline autoPlay muted width={160} height={120}></video>
      <br/>
      Local({madoi.getSelfPeerId().split("-")[0]})
      <button onClick={onStartMediaStreamClick}>{mediaStream === null ? "start" : "stop"}</button>
    </div>
    {room.peers.map(p=>
      <RemoteVideo key={p.id} peer={p} />
    )}
  </>;
}
