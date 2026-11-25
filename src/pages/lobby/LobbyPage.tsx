import './lobby.css'
import { useState } from 'react';
import { usePeer } from '../../net/peer-context';
import AudioControls from '../components/AudioControls';
import ChatWindow from '../components/ChatWindow';
import PlayerList from '../components/PlayerList';

type CopyStatus = 'idle' | 'copied' | 'error';

function LobbyPage() {
    const { status, peerId, role, players, hostId, error, features, startGame, leaveLobby } = usePeer();
    const isHost = role === 'host';
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

    const handleCopyLink = async () => {
        const link = `${window.location.origin}/lobby?entry=${encodeURIComponent(hostId ?? '')}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopyStatus('copied');
        } catch {
            setCopyStatus('error');
        }
    };

    return (
        <div>
            <p>Status: {status}</p>
            {error && <p className="error">{error}</p>}
            {peerId ? (
                <div>
                    {isHost ? (
                        <>
                            <p>Lobby code: <strong>{peerId}</strong></p>
                            <p>Share this code or the invite link with the players you want to invite.</p>
                            <button className="copy-link-button" onClick={handleCopyLink}>
                                {copyStatus === 'copied'
                                    ? 'Link copied!'
                                    : copyStatus === 'error'
                                        ? 'Copy failed'
                                        : 'Copy invite link'}
                            </button>
                        </>
                    ) : <p>Your peer ID: {peerId}</p>}
                </div>
            ) : <p>Connecting...</p>}
            {!isHost && hostId && <p>Joining lobby: {hostId}</p>}

            <div style={{width: "20vw"}}>
                <PlayerList players={players} peerId={peerId} hostId={hostId} />
                {features.voiceChat && <AudioControls />}
                {features.textChat && <ChatWindow />}
            </div>

            {isHost && <button onClick={startGame}>Start game</button>}
            <button onClick={leaveLobby}>{isHost ? 'Close lobby' : 'Leave lobby'}</button>
        </div>
    )
}

export default LobbyPage;