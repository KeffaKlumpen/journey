import { useEffect } from "react";

type CardPopupProps = {
    card: string;
    onClose: () => void;
};

function CardPopup({ card, onClose }: CardPopupProps) {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        <div className="popup-backdrop" onClick={onClose}>
            <div
                className="card-popup"
                role="dialog"
                aria-modal="true"
                aria-label={`Action card: ${card}`}
                onClick={(event) => event.stopPropagation()}
            >
                <p className="popup-label">Action card</p>
                <h2 className="popup-title">{card}</h2>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    )
}

export default CardPopup;
