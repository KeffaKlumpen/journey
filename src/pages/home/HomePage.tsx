import { Link } from 'react-router';
import './home.css'
import { useState } from 'react';

function HomePage() {
    const [peerId, setPeerId] = useState<string | undefined>(undefined);
    const validPeer = peerId != undefined && peerId.length > 0;

    return (
        <div>
            <Link to={'/lobby'}>Create lobby</Link>
            <label>Peer to join</label>
            <input type="text" value={peerId} onChange={(e) => setPeerId(e.target.value)}></input>
            <Link to={{ pathname: '/lobby', search: "entry=" + peerId }}>Join lobby</Link>
        </div>
    )
}

export default HomePage;