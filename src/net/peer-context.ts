import { createContext, useContext } from "react";
import type { GameState } from "../game/game-state";
import type { LobbyMessage, Player } from "./messages";

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
    startGame: () => void;
    leaveLobby: () => void;
    subscribe: (handler: (message: LobbyMessage) => void) => () => void;
    sendGameData: (payload: unknown) => void;
};

export const PeerContext = createContext<PeerContextValue | null>(null);

export function usePeer(): PeerContextValue {
    const context = useContext(PeerContext);
    if (!context) {
        throw new Error("usePeer must be used inside a PeerProvider");
    }
    return context;
}
