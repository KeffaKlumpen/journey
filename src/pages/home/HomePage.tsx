import { Link } from 'react-router';
import './home.css'
import { useState } from 'react';

function HomePage() {
    const [peerId, setPeerId] = useState("");
    const [textChat, setTextChat] = useState(true);
    const [voiceChat, setVoiceChat] = useState(true);
    const trimmedId = peerId.trim();
    const createSearch = `?textChat=${textChat ? "1" : "0"}&voiceChat=${voiceChat ? "1" : "0"}`;

    return (
        <div>
            <fieldset className="lobby-settings">
                <legend>Lobby settings</legend>
                <label>
                    <input
                        type="checkbox"
                        checked={textChat}
                        onChange={(event) => setTextChat(event.target.checked)}
                    />
                    Enable text chat
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={voiceChat}
                        onChange={(event) => setVoiceChat(event.target.checked)}
                    />
                    Enable voice chat
                </label>
            </fieldset>

            <Link to={{ pathname: '/lobby', search: createSearch }}>Create lobby</Link>
            <label>Peer to join</label>
            <input type="text" value={peerId} onChange={(e) => setPeerId(e.target.value)}></input>
            {trimmedId && (
                <Link to={{ pathname: '/lobby', search: `?entry=${encodeURIComponent(trimmedId)}` }}>Join lobby</Link>
            )}
        </div>
    )
}

export default HomePage;