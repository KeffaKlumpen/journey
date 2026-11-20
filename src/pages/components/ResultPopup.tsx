import type { VoteOption } from "../../net/messages";

type ResultPopupProps = {
    card: string;
    result: VoteOption;
    onClose: () => void;
};

function ResultPopup({ card, result, onClose }: ResultPopupProps) {
    return (
        <div className="popup-backdrop">
            <div className="card-popup" role="dialog" aria-modal="true" aria-label={`Result for ${card}`}>
                <p className="popup-label">The group decided</p>
                <h2 className="popup-title">{card}</h2>
                <p className="result-value">{result}</p>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    )
}

export default ResultPopup;
