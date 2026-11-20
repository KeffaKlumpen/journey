import type { VoteOption } from "../../net/messages";
import type { DiceRoll } from "./ResultPopup";

type GameOverPopupProps = {
    card: string;
    result: VoteOption;
    roll: DiceRoll;
    onClose: () => void;
};

function GameOverPopup({ card, result, roll, onClose }: GameOverPopupProps) {
    return (
        <div className="popup-backdrop">
            <div className="card-popup" role="dialog" aria-modal="true" aria-label="Game over">
                <p className="popup-label">Game over</p>
                <h2 className="popup-title">All encounters cleared</h2>
                <p className="popup-status">Final action: {card} → {result}</p>
                <p className="popup-status">Dice: {roll.dice.join(", ")}</p>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    )
}

export default GameOverPopup;
