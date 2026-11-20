import { type Action } from "../../game/card-data";

type HandProps = {
    cards: Action[];
    onCardClick?: (card: Action, index: number) => void;
};

function Hand({ cards, onCardClick }: HandProps) {
    return (
        <div className="hand">
            {cards.length === 0 ? (
                <p className="empty-hand">No cards left</p>
            ) : (
                cards.map((card, index) => (
                    <HandCard card={card} key={card} onClick={onCardClick ? () => onCardClick(card, index) : undefined} />
                ))
            )}
        </div>
    )
}

type HandCardProps = {
    card: Action;
    onClick?: () => void;
};

function HandCard({ card, onClick }: HandCardProps) {
    return (
        <button className="actionCard" onClick={onClick} disabled={!onClick}>
            <p>{card}</p>
        </button>
    );
}

export default Hand;
