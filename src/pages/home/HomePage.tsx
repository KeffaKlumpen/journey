import { Link, useNavigate } from 'react-router';
import './home.css'
import { useState, type FormEvent } from 'react';

function HomePage() {
    const navigate = useNavigate();
    const [peerId, setPeerId] = useState("");
    const [textChat, setTextChat] = useState(true);
    const [voiceChat, setVoiceChat] = useState(true);
    const trimmedId = peerId.trim();
    const createSearch = `?textChat=${textChat ? "1" : "0"}&voiceChat=${voiceChat ? "1" : "0"}`;

    const handleJoin = (event: FormEvent) => {
        event.preventDefault();
        if (!trimmedId) return;
        navigate({ pathname: '/lobby', search: `?entry=${encodeURIComponent(trimmedId)}` });
    };

    return (
        <main className="home">
            <section className="home-section">
                <h2>Create a lobby</h2>
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
                <Link className="home-button" to={{ pathname: '/lobby', search: createSearch }}>
                    Create lobby
                </Link>
            </section>

            <section className="home-section">
                <h2>Join a lobby</h2>
                <form className="join-form" onSubmit={handleJoin}>
                    <label htmlFor="host-id">Host peer ID</label>
                    <input
                        id="host-id"
                        type="text"
                        value={peerId}
                        onChange={(event) => setPeerId(event.target.value)}
                        placeholder="Enter the host's ID"
                    />
                    <button className="home-button" type="submit" disabled={!trimmedId}>Join lobby</button>
                </form>
            </section>

            <section className="home-section how-to-play">
                <h2>How to play</h2>
                <ol>
                    <li>Create a lobby and share your peer ID with the other players.</li>
                    <li>Everyone joins with that ID, then prepares the quest together.</li>
                    <li>On your turn, play an action card. The others vote, and you roll the dice.</li>
                    <li>Gain enough successes to pass each encounter and finish the main quest.</li>
                </ol>
            </section>
        </main>
    )
}

export default HomePage;