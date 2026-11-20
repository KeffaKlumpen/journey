import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePeer } from "../../net/peer-context";
import CardPopup from "../components/CardPopup";
import EncounterCard from "../components/EncounterCard";
import Hand from "../components/Hand";
import PlayerList from "../components/PlayerList";
import "./game.css";

function GamePage() {
    const { gameState, players, peerId, hostId, subscribe } = usePeer();
    const navigate = useNavigate();
    const [selectedCard, setSelectedCard] = useState<string | null>(null);

    useEffect(() => {
        if (!gameState) {
            navigate("/", { replace: true });
        }
    }, [gameState, navigate]);

    useEffect(() => subscribe((message) => {
        if (message.type === "game-data") {
            console.log("Game data received", message.payload);
        }
    }), [subscribe]);

    if (!gameState) {
        return null;
    }

    const encounter = gameState.encounters[gameState.currentEncounterIndex];

    return (
        <div className="game-layout">
            <aside className="player-sidebar">
                <PlayerList players={players} peerId={peerId} hostId={hostId} />
            </aside>
            <main className="game-board">
                <EncounterCard encounter={encounter}></EncounterCard>
                <Hand cards={gameState.hand} onCardClick={(card) => setSelectedCard(card)}></Hand >
            </main>
            {selectedCard && (
                <CardPopup card={selectedCard} onClose={() => setSelectedCard(null)} />
            )}
        </div>
    )
}

export default GamePage;
