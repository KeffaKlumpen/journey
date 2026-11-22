import type { VoteOption } from "../../net/messages";
import type { DiceRoll } from "./ResultPopup";

type GameOverPopupProps = {
    card: string;
    result: VoteOption;
    roll: DiceRoll;
    onBackToLobby: () => void;
};

function GameOverPopup({ card, result, roll, onBackToLobby }: GameOverPopupProps) {
    return (
        <div className="popup-backdrop">
            <div className="card-popup" role="dialog" aria-modal="true" aria-label="Conclude the story">
                <p className="popup-label">The quest is complete</p>
                <h2 className="popup-title">Conclude the story</h2>
                <p className="popup-status">All encounters cleared</p>
                <p className="popup-status">Final action: {card} → {result}</p>
                <p className="popup-status">Dice: {roll.dice.join(", ")}</p>
                <button onClick={onBackToLobby}>Back to lobby</button>
            </div>
        </div>
    )
}

export default GameOverPopup;