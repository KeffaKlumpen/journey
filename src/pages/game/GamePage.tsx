import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePeer } from "../../net/peer-context";
import EncounterCard from "../components/EncounterCard";
import Hand from "../components/Hand";
import PlayerList from "../components/PlayerList";
import "./game.css";

function GamePage() {
    const { gameState, players, peerId, hostId, subscribe } = usePeer();
    const navigate = useNavigate();

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
                <Hand cards={gameState.hand}></Hand >
            </main>
        </div>
    )
}

export default GamePage;
