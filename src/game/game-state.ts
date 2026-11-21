import { actions, encounters, mainQuests, type Action, type Encounter, type MainQuest } from "./card-data";

export type GameState = {
    hand: Action[];
    encounters: Encounter[];
    quest: MainQuest;
    currentEncounterIndex: number;
    successes: number;
};

function shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function createHand(): Action[] {
    return shuffle(actions).slice(0, 5);
}

export function createEncounters(): Encounter[] {
    return shuffle(encounters).slice(0, 5);
}

export function createQuest(): MainQuest {
    return mainQuests[Math.floor(Math.random() * mainQuests.length)];
}

export function createGameState(
    hand: Action[],
    drawnEncounters: Encounter[],
    quest: MainQuest
): GameState {
    return {
        hand,
        encounters: drawnEncounters,
        quest,
        currentEncounterIndex: 0,
        successes: 0,
    };
}
