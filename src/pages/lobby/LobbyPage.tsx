import './lobby.css'
import { usePeer } from '../../net/peer-context';

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

            <h2>Players</h2>
            <ul>
                {players.map((player) => (
                    <li key={player.id}>
                        {player.id}
                        {player.id === peerId ? ' (you)' : ''}
                        {player.id === hostId ? ' (host)' : ''}
                    </li>
                ))}
            </ul>

            {isHost && <button onClick={startGame}>Start game</button>}
            <button onClick={leaveLobby}>{isHost ? 'Close lobby' : 'Leave lobby'}</button>
        </div>
    )
}

export default LobbyPage;
