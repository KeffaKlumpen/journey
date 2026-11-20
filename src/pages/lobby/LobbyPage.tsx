import './lobby.css'
import { usePeer } from '../../net/peer-context';
import PlayerList from '../components/PlayerList';

function LobbyPage() {
    const { status, peerId, role, players, hostId, error, startGame, leaveLobby } = usePeer();
    const isHost = role === 'host';

    return (
        <div>
            <p>Status: {status}</p>
            {error && <p className="error">{error}</p>}
            {peerId ? (
                <div>
                    <p>Your peer ID: {peerId}</p>
                    {isHost && <p>Share this ID with the players you want to invite.</p>}
                </div>
            ) : <p>Connecting...</p>}
            {!isHost && hostId && <p>Joining lobby: {hostId}</p>}

            <div style={{width: "20vw"}}>
                <PlayerList players={players} peerId={peerId} hostId={hostId} />
            </div>

            {isHost && <button onClick={startGame}>Start game</button>}
            <button onClick={leaveLobby}>{isHost ? 'Close lobby' : 'Leave lobby'}</button>
        </div>
    )
}

export default LobbyPage;
