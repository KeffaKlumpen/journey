import type { VoteOption } from "../../net/messages";

export type DiceRoll = {
    dice: number[];
    gained: number;
    encounterSuccesses: number;
};

type ResultPopupProps = {
    card: string;
    result: VoteOption;
    proposerId: string;
    peerId: string | undefined;
    canRoll: boolean;
    roll?: DiceRoll;
    onRoll: () => void;
    onClose: () => void;
};

function ResultPopup({ card, result, proposerId, peerId, canRoll, roll, onRoll, onClose }: ResultPopupProps) {
    return (
        <div className="popup-backdrop">
            <div className="card-popup" role="dialog" aria-modal="true" aria-label={`Result for ${card}`}>
                <p className="popup-label">The group decided</p>
                <h2 className="popup-title">{card}</h2>
                <p className="result-value">{result}</p>
                {roll ? (
                    <>
                        <p className="popup-status">Dice: {roll.dice.join(", ")}</p>
                        <p className="popup-status">
                            {roll.gained} success{roll.gained === 1 ? "" : "es"} · {roll.encounterSuccesses}/3 on this encounter
                        </p>
                        <button onClick={onClose}>Close</button>
                    </>
                ) : canRoll ? (
                    <button onClick={onRoll}>Roll dice</button>
                ) : (
                    <p className="popup-status">
                        Waiting for {proposerId === peerId ? "you" : proposerId.slice(0, 8)} to roll...
                    </p>
                )}
            </div>
        </div>
    )
}

export default ResultPopup;
