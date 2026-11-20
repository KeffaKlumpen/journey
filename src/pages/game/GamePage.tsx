import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePeer } from "../../net/peer-context";
import EncounterCard from "../components/EncounterCard";
import Hand from "../components/Hand";

function GamePage() {
    const { gameState, subscribe } = usePeer();
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
        <div>
            <EncounterCard encounter={encounter}></EncounterCard>
            <Hand cards={gameState.hand}></Hand >
        </div>
    )
}

export default GamePage;
