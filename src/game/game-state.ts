import { actions, encounters, type Action, type Encounter } from "./card-data";

export type GameState = {
    hand: Action[];
    encounters: Encounter[];
    currentEncounterIndex: number;
};

function shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function createGameState(): GameState {
    return {
        hand: shuffle(actions).slice(0, 5),
        encounters: shuffle(encounters).slice(0, 5),
        currentEncounterIndex: 0,
    };
}
