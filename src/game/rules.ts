import type { VoteOption } from "../net/messages";

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

    if (total < 3) {
        return {
            gained,
            successes: total,
            currentEncounterIndex,
            advanced: false,
            gameOver: false,
        };
    }

    if (currentEncounterIndex >= encounterCount - 1) {
        return {
            gained,
            successes: 3,
            currentEncounterIndex,
            advanced: false,
            gameOver: true,
        };
    }

    return {
        gained,
        successes: 0,
        currentEncounterIndex: currentEncounterIndex + 1,
        advanced: true,
        gameOver: false,
    };
}
