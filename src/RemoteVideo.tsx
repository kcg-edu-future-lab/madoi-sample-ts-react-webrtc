import { useEffect, useRef, useState, type FormEventHandler } from "react";
import type { Peer, TrackAddedEventListenerOrObject, TrackRemovedEventListenerOrObject } from "./Peer";

interface Props{
  peer: Peer;
}
/**
 * 通信相手のビデオを表示するコンポーネント
 */
export function RemoteVideo({peer}: Props){
  const [showPlayButton, setShowPlayButton] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null!);

  // 接続先のメディアストリームが利用できるようになった際の処理
  const onTrackAdded: TrackAddedEventListenerOrObject = ({detail: {streams}})=>{
    const video = videoRef.current;
    if(video.srcObject === null){
      video.srcObject = new MediaStream();
    }
    streams.forEach(s=>{
      s.getTracks().forEach(t=>{
        (video.srcObject as MediaStream).addTrack(t);
      });
    });
    // videoタグを再生。エラーになった場合は再生ボタンを表示する。
    video.play().catch(()=>setShowPlayButton(true));
  };
  // 接続先のメディアストリームが無効になった際の処理
  const onTrackRemoved: TrackRemovedEventListenerOrObject = ({detail: {track}})=>{
    const ms = videoRef.current.srcObject as MediaStream;
    if(ms === null) return;
    ms.removeTrack(track);
    if(ms.getTracks().length === 0){
      videoRef.current.srcObject = null;
    }
  };
  // playがボタンクリックされた際の処理
  const onPlayClick: FormEventHandler = e=>{
    e.preventDefault();
    videoRef.current.play();
    setShowPlayButton(false);
  };

  useEffect(()=>{
    peer.addEventListener("trackAdded", onTrackAdded);
    peer.addEventListener("trackRemoved", onTrackRemoved);
    return ()=>{
      peer.removeEventListener("trackRemoved", onTrackRemoved);
      peer.removeEventListener("trackAdded", onTrackAdded);
    };
  });

  return <div style={{border: "solid 1px", padding: "2px"}}>
    <video ref={videoRef} playsInline autoPlay width={160} height={120}></video>
    <br/>
    Remote({peer.id.split("-")[0]})
    <button onClick={onPlayClick} style={{visibility: showPlayButton? "visible" : "hidden"}}>play</button>
  </div>;
}
