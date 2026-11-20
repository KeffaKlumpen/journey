import type { GameState } from "../game/game-state";

export type Player = {
    id: string;
};

export type LobbyMessage =
    | { type: "join"; player: Player }
    | { type: "lobby-state"; players: Player[]; hostId: string }
    | { type: "leave"; playerId: string }
    | { type: "lobby-closed" }
    | { type: "start-game"; game: GameState }
    | { type: "game-data"; payload: unknown };

export function isLobbyMessage(value: unknown): value is LobbyMessage {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        typeof (value as { type: unknown }).type === "string"
    );
}
