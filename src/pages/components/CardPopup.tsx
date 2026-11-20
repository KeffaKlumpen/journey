import { VOTE_OPTIONS, type VoteOption } from "../../net/messages";

type CardPopupProps = {
    card: string;
    isProposer: boolean;
    isWaiting: boolean;
    votesReceived: number;
    totalVoters: number;
    onVote: (vote: VoteOption) => void;
};

function CardPopup({ card, isProposer, isWaiting, votesReceived, totalVoters, onVote }: CardPopupProps) {
    const waiting = isProposer || isWaiting;

    return (
        <div className="popup-backdrop">
            <div
                className="card-popup"
                role="dialog"
                aria-modal="true"
                aria-label={`Action card: ${card}`}
            >
                {isProposer && <p className="popup-label">You proposed an action</p>}
                {!waiting && <p className="popup-label">Is this a good idea?</p>}
                <h2 className="popup-title">{card}</h2>
                {waiting ? (
                    <p className="popup-status">Waiting for votes... ({votesReceived}/{totalVoters})</p>
                ) : (
                    <div className="vote-options">
                        {VOTE_OPTIONS.map((option) => (
                            <button key={option} onClick={() => onVote(option)}>{option}</button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default CardPopup;
