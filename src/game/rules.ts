import type { VoteOption } from "../net/messages";
import { type Action, actions, type Encounter, encounters, type MainQuest, mainQuests } from "./card-data";
import { shuffle, type GameState } from "./game-state";

const SUCCESS_REQUIRED = 1; //3;
const ENCOUNTER_COUNT = 1; //5;

export const DICE_COUNT: Record<VoteOption, number> = {
    BAD: 1,
    OK: 2,
    GOOD: 3,
    GREAT: 4,
};

export function rollDice(count: number): number[] {
    return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export type EncounterResolution = {
    gained: number;
    /** Successes on the encounter that was just resolved (for display). */
    encounterSuccesses: number;
    /** Successes to store for the current encounter going forward. */
    successes: number;
    currentEncounterIndex: number;
    advanced: boolean;
    gameOver: boolean;
};

export function resolveEncounter(
    successes: number,
    dice: number[],
    currentEncounterIndex: number,
    encounterCount: number
): EncounterResolution {
    const gained = dice.filter((die) => die >= 5).length;
    const total = successes + gained;

    if (total < SUCCESS_REQUIRED) {
        return {
            gained,
            encounterSuccesses: total,
            successes: total,
            currentEncounterIndex,
            advanced: false,
            gameOver: false,
        };
    }

    if (currentEncounterIndex >= encounterCount - 1) {
        return {
            gained,
            encounterSuccesses: 3,
            successes: 3,
            currentEncounterIndex,
            advanced: false,
            gameOver: true,
        };
    }

    return {
        gained,
        encounterSuccesses: 3,
        successes: 0,
        currentEncounterIndex: currentEncounterIndex + 1,
        advanced: true,
        gameOver: false,
    };
}

export function createHand(): Action[] {
    return shuffle(actions).slice(0, 5);
}

export function createEncounters(): Encounter[] {
    return shuffle(encounters).slice(0, ENCOUNTER_COUNT);
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

