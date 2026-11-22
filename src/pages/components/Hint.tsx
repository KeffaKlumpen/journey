import type { Hint } from "../../game/hints";

type HintProps = {
    hint: Hint;
};

function HintCard({ hint }: HintProps) {
    return (
        <div className="hint">
            <h3 className="hint-title">{hint.title}</h3>
            <p className="hint-paragraph">{hint.paragraph}</p>
        </div>
    );
}

export default HintCard;
