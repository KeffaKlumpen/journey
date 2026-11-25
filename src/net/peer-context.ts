import { createContext, useContext } from "react";
import type { Action } from "../game/card-data";
import type { GameState } from "../game/game-state";
import type { ChatMessage, GameDataPayload, GameSyncState, LobbyFeatures, LobbyMessage, Player } from "./messages";

export type Status = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
export type Role = "host" | "guest" | null;

export type ReconnectInfo = {
    attempt: number;
    maxAttempts: number;
};

export type PeerContextValue = {
    status: Status;
    peerId: string | undefined;
    role: Role;
    players: Player[];
    hostId: string | null;
    error: string | null;
    reconnect: ReconnectInfo | null;
    retryNow: () => void;
    gameState: GameState | null;
    syncGameState: (game: GameState) => void;
    registerSyncSource: (source: () => GameSyncState | null) => () => void;
    applyGameProgress: (progress: Pick<GameState, "successes" | "currentEncounterIndex">) => void;
    playCard: (card: Action) => void;
    setCharacterName: (characterName: string) => void;
    clearCharacterName: (playerId: string) => void;
    isMuted: boolean;
    toggleMute: () => void;
    unmutedPlayerIds: string[];
    voiceError: string | null;
    chatMessages: ChatMessage[];
    sendChat: (text: string) => void;
    features: LobbyFeatures;
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
