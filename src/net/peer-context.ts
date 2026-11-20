import { createContext, useContext } from "react";
import type { Action } from "../game/card-data";
import type { GameState } from "../game/game-state";
import type { GameDataPayload, LobbyMessage, Player } from "./messages";

export type Status = "connecting" | "connected" | "disconnected" | "error";
export type Role = "host" | "guest" | null;

export type PeerContextValue = {
    status: Status;
    peerId: string | undefined;
    role: Role;
    players: Player[];
    hostId: string | null;
    error: string | null;
    gameState: GameState | null;
    applyGameProgress: (progress: Pick<GameState, "successes" | "currentEncounterIndex">) => void;
    startGame: () => void;
    leaveLobby: () => void;
    subscribe: (handler: (message: LobbyMessage) => void) => () => void;
    sendGameData: (payload: GameDataPayload) => void;
    proposeCard: (card: Action) => void;
};

export const PeerContext = createContext<PeerContextValue | null>(null);

export function usePeer(): PeerContextValue {
    const context = useContext(PeerContext);
    if (!context) {
        throw new Error("usePeer must be used inside a PeerProvider");
    }
    return context;
}
