import type { Player } from "../../net/messages";

type QuestFailedPopupProps = {
    questTitle: string;
    donePlayers: string[];
    players: Player[];
    peerId: string | undefined;
    onDone: () => void;
};

function QuestFailedPopup({ questTitle, donePlayers, players, peerId, onDone }: QuestFailedPopupProps) {
    const isDone = donePlayers.includes(peerId ?? "");

    return (
        <div className="popup-backdrop">
            <div
                className="card-popup"
                role="alertdialog"
                aria-modal="true"
                aria-label="Quest failed"
            >
                <p className="popup-label">The quest is over</p>
                <h2 className="popup-title">Quest failed</h2>
                <p className="popup-status">{questTitle}</p>
                <p className="popup-status">No cards left, and the last encounter was not cleared.</p>
                <div className="popup-ready">
                    <p className="popup-label">Done ({donePlayers.length}/{players.length})</p>
                    <ul>
                        {players.map((player) => {
                            const ready = donePlayers.includes(player.id);
                            const label = player.characterName
                                ?? (player.id === peerId ? "You" : player.id.slice(0, 8));
                            return (
                                <li key={player.id} className={ready ? "ready" : undefined}>
                                    <span>{label}</span>
                                    {ready && <span> ✓</span>}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <button onClick={onDone} disabled={isDone}>
                    {isDone ? "Waiting for others..." : "Done"}
                </button>
            </div>
        </div>
    );
}

export default QuestFailedPopup;
