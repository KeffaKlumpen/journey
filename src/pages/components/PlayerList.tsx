import type { Player } from "../../net/messages";

type PlayerListProps = {
    players: Player[];
    peerId: string | undefined;
    hostId: string | null;
    title?: string;
};

function PlayerList({ players, peerId, hostId, title = "Players" }: PlayerListProps) {
    return (
        <div className="player-list">
            <h2>{title} ({players.length})</h2>
            <ul>
                {players.map((player) => (
                    <li key={player.id} className={player.id === peerId ? "you" : undefined}>
                        <span className="player-name" title={player.id}>
                            {player.characterName ?? (player.id.length > 10 ? `${player.id.slice(0, 8)}…` : player.id)}
                        </span>
                        {player.id === peerId && <span className="player-tag">you</span>}
                        {player.id === hostId && <span className="player-tag">host</span>}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default PlayerList;
