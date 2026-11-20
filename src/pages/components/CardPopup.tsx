import { VOTE_OPTIONS, type VoteOption } from "../../net/messages";

type CardPopupProps = {
    card: string;
    isProposer: boolean;
    votesReceived: number;
    totalVoters: number;
    onVote: (vote: VoteOption) => void;
};

function CardPopup({ card, isProposer, votesReceived, totalVoters, onVote }: CardPopupProps) {
    return (
        <div className="popup-backdrop">
            <div
                className="card-popup"
                role="dialog"
                aria-modal="true"
                aria-label={`Action card: ${card}`}
            >
                <p className="popup-label">
                    {isProposer ? "You proposed an action" : "Is this a good idea?"}
                </p>
                <h2 className="popup-title">{card}</h2>
                {isProposer ? (
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
