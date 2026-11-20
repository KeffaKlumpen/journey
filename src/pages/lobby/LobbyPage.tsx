import { Peer } from "peerjs"
import './lobby.css'
import { useEffect, useRef, useState } from "react";

function LobbyPage() {
    const [peerId, setPeerId] = useState<string | undefined>(undefined);
    const [connStatus, setConnStatus] = useState<"disconnected" | "connected">("disconnected")
    const peerInstance = useRef<Peer>(null);
    useEffect(() => {
        const peer = new Peer({
            config: {
                iceServers: [
                    {
                        urls: 'stun:stun.l.google.com:19302'
                    },
                    {
                        urls: 'turn:free.expressturn.com:3478',
                        username: '000000002108492650',
                        credential: 'pGblr6Sgj6o6mLOJjl9QckoJlWY=',
                    }
                ],
                debug: 3
            }
        });

        console.log("Created peer obj");

        peer.on('open', (id) => {
            console.log("peer opened");
            setPeerId(id)
            setConnStatus("connected");
        });
        peer.on('close', () => setConnStatus("disconnected"));
        peerInstance.current = peer;
    }, [])

    return (
        <div>
            Status: {connStatus}
            {peerId ? <p>{peerId}</p> : "Connecting..."}
            Lets find some people!
        </div>
    )
}

export default LobbyPage;