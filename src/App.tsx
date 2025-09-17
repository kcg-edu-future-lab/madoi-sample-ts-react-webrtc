import { useRef, useState } from 'react'
import './App.css'
import { Madoi } from 'madoi-client';
import { useSharedModel } from 'madoi-client-react';
import { RemoteVideo } from './RemoteVideo';
import { Room } from './Room';

interface Props{
  madoi: Madoi;
}
export default function App({madoi}: Props) {
  // マイク・カメラのストリームはReactの状態として管理。
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  // madoi-react準拠のRoomクラスの利用を宣言。Roomの@PeerEnteredなどのメソッドが
  // 呼ばれると、Reactのレンダリングも行われる。
  const room = useSharedModel(madoi, ()=>new Room());
	const localVideoRef = useRef<HTMLVideoElement>(null!);

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
