import { useState } from "react";
import type { Action, MainQuest } from "../../game/card-data";
import type { Player } from "../../net/messages";
import Hand from "./Hand";

type PrepPhaseProps = {
    quest: MainQuest;
    step: number;
    totalSteps: number;
    prompt: string;
    hand: Action[];
    donePlayers: string[];
    players: Player[];
    peerId: string | undefined;
    onDone: (characterName?: string) => void;
};

function PrepPhase({
    quest,
    step,
    totalSteps,
    prompt,
    hand,
    donePlayers,
    players,
    peerId,
    onDone,
}: PrepPhaseProps) {
    const [characterName, setCharacterName] = useState("");
    const isDone = donePlayers.includes(peerId ?? "");
    const isIdentityStep = step === totalSteps - 1;
    const needsName = isIdentityStep && characterName.trim() === "";

    const handleDone = () => {
        onDone(isIdentityStep ? characterName.trim() : undefined);
    };

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

            {isIdentityStep && (
                <div className="prep-identity">
                    <Hand cards={hand} />
                    <label className="prep-name-field">
                        Your character name
                        <input
                            type="text"
                            value={characterName}
                            onChange={(event) => setCharacterName(event.target.value)}
                            disabled={isDone}
                            maxLength={40}
                            placeholder="Enter a name"
                        />
                    </label>
                </div>
            )}

            <div className="prep-ready">
                <p className="prep-label">Ready ({donePlayers.length}/{players.length})</p>
                <ul>
                    {players.map((player) => {
                        const ready = donePlayers.includes(player.id);
                        const label = player.characterName
                            ?? (player.id === peerId ? "You" : player.id.slice(0, 8));
                        return (
                            <li key={player.id} className={ready ? "ready" : undefined}>
                                {label}
                                {ready ? " ✓" : ""}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <button onClick={handleDone} disabled={isDone || needsName}>
                {isDone ? "Waiting for others..." : "I'm done"}
            </button>
        </main>
    );
}

export default PrepPhase;
