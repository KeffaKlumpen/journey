import type { Action } from "../game/card-data";
import type { GameState } from "../game/game-state";

export type Player = {
    id: string;
    characterName?: string;
};

export const VOTE_OPTIONS = ["BAD", "OK", "GOOD", "GREAT"] as const;
export type VoteOption = typeof VOTE_OPTIONS[number];

export type GameDataPayload =
    | { kind: "prep-name"; playerId: string; characterName: string }
    | { kind: "prep-done"; playerId: string; step: number }
    | { kind: "prep-advance"; step: number }
    | { kind: "prep-complete" }
    | { kind: "card-proposal"; proposalId: string; proposerId: string; card: Action }
    | { kind: "card-played"; proposalId: string; proposerId: string; card: Action }
    | { kind: "card-vote"; proposalId: string; voterId: string; vote: VoteOption }
    | { kind: "vote-result"; proposalId: string; proposerId: string; card: Action; result: VoteOption }
    | { kind: "roll-request"; proposalId: string; proposerId: string }
    | {
        kind: "dice-result";
        proposalId: string;
        proposerId: string;
        card: Action;
        result: VoteOption;
        dice: number[];
        gained: number;
        encounterSuccesses: number;
        successes: number;
        currentEncounterIndex: number;
        gameOver: boolean;
    };

export type LobbyMessage =
    | { type: "join"; player: Player }
    | { type: "lobby-state"; players: Player[]; hostId: string }
    | { type: "leave"; playerId: string }
    | { type: "lobby-closed" }
    | { type: "start-game"; game: GameState }
    | { type: "game-data"; payload: GameDataPayload };

export function isLobbyMessage(value: unknown): value is LobbyMessage {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        typeof (value as { type: unknown }).type === "string"
    );
}

export function isGameDataPayload(value: unknown): value is GameDataPayload {
    if (typeof value !== "object" || value === null || !("kind" in value)) return false;
    const kind = (value as { kind: unknown }).kind;
    return (
        kind === "prep-name" ||
        kind === "prep-done" ||
        kind === "prep-advance" ||
        kind === "prep-complete" ||
        kind === "card-proposal" ||
        kind === "card-played" ||
        kind === "card-vote" ||
        kind === "vote-result" ||
        kind === "roll-request" ||
        kind === "dice-result"
    );
}
