import type { Action, Encounter } from "../game/card-data";
import type { GameState } from "../game/game-state";

export type Player = {
    id: string;
    characterName?: string;
    /** False while this player is temporarily disconnected and may rejoin. */
    connected?: boolean;
};

export type ChatMessage = {
    id: string;
    senderId: string;
    text: string;
    timestamp: number;
};

export type LobbyFeatures = {
    textChat: boolean;
    voiceChat: boolean;
};

export const VOTE_OPTIONS = ["BAD", "OK", "GOOD", "GREAT"] as const;
export type VoteOption = typeof VOTE_OPTIONS[number];

export type GameDataPayload =
    | { kind: "prep-name"; playerId: string; characterName: string }
    | { kind: "prep-name-reset"; playerId: string }
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
    }
    | { kind: "quest-failed" }
    | { kind: "quest-failed-done"; playerId: string }
    | { kind: "quest-failed-complete" };

export type GameProposal = {
    proposalId: string;
    proposerId: string;
    card: Action;
};

export type GameVote = {
    proposalId: string;
    voterId: string;
    vote: VoteOption;
};

export type ActionAttemptState = {
    action: Action;
    gained: number;
    successes: number;
};

export type PassedEncounterState = {
    encounter: Encounter;
    attempts: ActionAttemptState[];
};

export type SyncResult = {
    proposalId: string;
    proposerId: string;
    card: Action;
    result: VoteOption;
    roll?: {
        dice: number[];
        gained: number;
        encounterSuccesses: number;
        gameOver: boolean;
    };
};

export type QuestFailedState = {
    done: string[];
};

/** Everything a guest needs to resume a session after a network interruption. */
export type GameSyncState = {
    game: GameState | null;
    prep: { step: number; done: string[]; complete: boolean };
    questFailed: QuestFailedState | null;
    proposal: GameProposal | null;
    votes: GameVote[];
    result: SyncResult | null;
    passedEncounters: PassedEncounterState[];
    currentAttempts: ActionAttemptState[];
    lastEncounterIndex: number;
    unmutedPlayerIds: string[];
    chatMessages: ChatMessage[];
};

export type LobbyMessage =
    | { type: "join"; player: Player }
    | { type: "lobby-state"; players: Player[]; hostId: string; features: LobbyFeatures }
    | { type: "leave"; playerId: string }
    | { type: "lobby-closed" }
    | { type: "mute-state"; playerId: string; muted: boolean }
    | { type: "chat"; message: ChatMessage }
    | { type: "start-game"; game: GameState }
    | { type: "game-data"; payload: GameDataPayload }
    | { type: "ping"; id: number }
    | { type: "pong"; id: number }
    | { type: "resync-request"; playerId: string }
    | { type: "game-sync"; sync: GameSyncState };

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
        kind === "prep-name-reset" ||
        kind === "prep-done" ||
        kind === "prep-advance" ||
        kind === "prep-complete" ||
        kind === "card-proposal" ||
        kind === "card-played" ||
        kind === "card-vote" ||
        kind === "vote-result" ||
        kind === "roll-request" ||
        kind === "dice-result" ||
        kind === "quest-failed" ||
        kind === "quest-failed-done" ||
        kind === "quest-failed-complete"
    );
}
