import { useState } from "react";
import { actions, encounters as availableEncounters } from "../game/card-data";
import EncounterCard from "./components/EncounterCard";
import Hand from "./components/Hand";

function GamePage() {
    const [hand] = useState(actions.sort((_a, _b) => Math.random() - 0.5).slice(0, 5))
    const [encounters] = useState(availableEncounters.sort((_a, _b) => Math.random() - 0.5).slice(0, 5));
    const [currentEncounter] = useState(encounters[0])

    return (
        <div>
            <EncounterCard encounter={currentEncounter}></EncounterCard>
            <Hand cards={hand}></Hand >
        </div>
    )
}

export default GamePage;