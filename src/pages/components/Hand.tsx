import { type Action } from "../../game/card-data";

type HandProps = {
    cards: Action[]
}
function Hand({ cards }: HandProps) {
    return (
        <div className="hand">
            {cards.map((c) => (
                <HandCard card={c} key={c} />
            ))}
        </div>
    )
}
function HandCard({ card }: { card: Action }) {
    return (
        <div className="actionCard">
            <p>{card}</p>
        </div>
    );
}

export default Hand;