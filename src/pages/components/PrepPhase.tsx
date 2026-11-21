import type { MainQuest } from "../../game/card-data";
import type { Player } from "../../net/messages";

type PrepPhaseProps = {
    quest: MainQuest;
    step: number;
    totalSteps: number;
    prompt: string;
    donePlayers: string[];
    players: Player[];
    peerId: string | undefined;
    onDone: () => void;
};

function PrepPhase({
    quest,
    step,
    totalSteps,
    prompt,
    donePlayers,
    players,
    peerId,
    onDone,
}: PrepPhaseProps) {
    const isDone = donePlayers.includes(peerId ?? "");

    return (
        <main className="prep-phase">
            <p className="prep-label">Preparing the quest · {step + 1}/{totalSteps}</p>
            <h2 className="prep-quest">{quest.title}</h2>

            <div className="prep-prompt-card">
                <p className="prep-prompt">{prompt}</p>
                {step === 0 && (
                    <ul className="prep-helpers">
                        {quest.prompts.map((helper) => (
                            <li key={helper}>{helper}</li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="prep-ready">
                <p className="prep-label">Ready ({donePlayers.length}/{players.length})</p>
                <ul>
                    {players.map((player) => {
                        const ready = donePlayers.includes(player.id);
                        return (
                            <li key={player.id} className={ready ? "ready" : undefined}>
                                {player.id === peerId ? "You" : player.id.slice(0, 8)}
                                {ready ? " ✓" : ""}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <button onClick={onDone} disabled={isDone}>
                {isDone ? "Waiting for others..." : "I'm done"}
            </button>
        </main>
    );
}

export default PrepPhase;
