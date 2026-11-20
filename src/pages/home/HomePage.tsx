import { Link } from 'react-router';
import './home.css'
import { useState } from 'react';

function HomePage() {
    const [peerId, setPeerId] = useState("");
    const trimmedId = peerId.trim();

    return (
        <div>
            <Link to={'/lobby'}>Create lobby</Link>
            <label>Peer to join</label>
            <input type="text" value={peerId} onChange={(e) => setPeerId(e.target.value)}></input>
            {trimmedId && (
                <Link to={{ pathname: '/lobby', search: `?entry=${encodeURIComponent(trimmedId)}` }}>Join lobby</Link>
            )}
        </div>
    )
}

export default HomePage;
