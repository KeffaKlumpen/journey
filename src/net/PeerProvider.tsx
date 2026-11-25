import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { Peer, type DataConnection, type MediaConnection } from "peerjs";
import { useNavigate, useSearchParams } from "react-router";
import type { Action } from "../game/card-data";
import { type GameState } from "../game/game-state";
import { createEncounters, createGameState, createHand, createQuest } from "../game/rules";
import { generateLobbyCode, normalizeLobbyCode } from "./lobby-code";
import {
    isLobbyMessage,
    type ChatMessage,
    type GameDataPayload,
    type GameSyncState,
    type LobbyFeatures,
    type LobbyMessage,
    type Player,
} from "./messages";
import { PeerContext, type PeerContextValue, type ReconnectInfo, type Role, type Status } from "./peer-context";

type Proposal = Omit<Extract<GameDataPayload, { kind: "card-played" }>, "kind">;

const MAX_CODE_ATTEMPTS = 5;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MIN_HEARTBEAT_INTERVAL_MS = 5_000;
const MAX_HEARTBEAT_INTERVAL_MS = 10_000;
const MIN_HEARTBEAT_TIMEOUT_MS = 15_000;
const MAX_HEARTBEAT_TIMEOUT_MS = 30_000;
const HEARTBEAT_RTT_FACTOR = 4;
const ROSTER_GRACE_MS = 12_000;

const TRANSIENT_ERRORS = new Set([
    "network",
    "socket-error",
    "socket-closed",
    "peer-unavailable",
    "negotiation-failed",
    "connection-closed",
    "not-open-yet",
    "webrtc",
    "disconnected",
]);

function isTransientError(type: string): boolean {
    return TRANSIENT_ERRORS.has(type);
}

function featureEnabled(value: string | null): boolean {
    return value !== "0";
}

export function PeerProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const navigateRef = useRef(navigate);
    const [searchParams] = useSearchParams();
    const rawEntryId = searchParams.get("entry");
    const entryId = rawEntryId ? normalizeLobbyCode(rawEntryId) : null;
    const entryIdRef = useRef<string | null>(entryId);
    const [features, setFeatures] = useState<LobbyFeatures>(() => entryId
        ? { textChat: false, voiceChat: false }
        : {
            textChat: featureEnabled(searchParams.get("textChat")),
            voiceChat: featureEnabled(searchParams.get("voiceChat")),
        });
    const featuresRef = useRef<LobbyFeatures>(features);
    const featuresKnownRef = useRef(entryId === null);
    const voiceStartedRef = useRef(false);

    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate]);

    const peerRef = useRef<Peer | null>(null);
    const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const roleRef = useRef<Role>(null);
    const playersRef = useRef<Player[]>([]);
    const leavingRef = useRef(false);
    const activeProposalRef = useRef<Proposal | null>(null);
    const handlersRef = useRef<Set<(message: LobbyMessage) => void>>(new Set());
    const localStreamRef = useRef<MediaStream | null>(null);
    const mediaConnectionsRef = useRef<Map<string, MediaConnection>>(new Map());
    const pendingCallsRef = useRef<Map<string, MediaConnection>>(new Map());
    const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const isMutedRef = useRef(true);
    const gameStateRef = useRef<PeerContextValue["gameState"]>(null);
    const sessionIdRef = useRef<string | null>(null);
    const handsRef = useRef<Map<string, Action[]>>(new Map());
    const unmutedPlayerIdsRef = useRef<string[]>([]);
    const chatMessagesRef = useRef<ChatMessage[]>([]);
    const syncSourceRef = useRef<(() => GameSyncState | null) | null>(null);
    const retryNowRef = useRef<(() => void) | null>(null);

    const [status, setStatus] = useState<Status>("connecting");
    const [peerId, setPeerId] = useState<string | undefined>(undefined);
    const [role, setRole] = useState<Role>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [hostId, setHostId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reconnect, setReconnect] = useState<ReconnectInfo | null>(null);
    const [gameState, setGameState] = useState<PeerContextValue["gameState"]>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [unmutedPlayerIds, setUnmutedPlayerIds] = useState<string[]>([]);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const dispatch = useCallback((message: LobbyMessage) => {
        for (const handler of handlersRef.current) {
            handler(message);
        }
    }, []);

    const send = useCallback((connection: DataConnection, message: LobbyMessage) => {
        if (!connection.open) return;
        connection.send(message);
    }, []);

    const broadcast = useCallback((message: LobbyMessage) => {
        for (const connection of connectionsRef.current.values()) {
            send(connection, message);
        }
    }, [send]);

    const syncGameState = useCallback((game: GameState) => {
        gameStateRef.current = game;
        setGameState(game);
    }, []);

    const registerSyncSource = useCallback((source: () => GameSyncState | null) => {
        syncSourceRef.current = source;
        return () => {
            if (syncSourceRef.current === source) syncSourceRef.current = null;
        };
    }, []);

    // Only the host accepts proposals, so there is a single active vote at a time.
    const acceptProposal = useCallback((proposal: Proposal) => {
        if (activeProposalRef.current) return;
        activeProposalRef.current = proposal;
        const hand = handsRef.current.get(proposal.proposerId);
        if (hand) {
            const index = hand.indexOf(proposal.card);
            if (index !== -1) {
                handsRef.current.set(proposal.proposerId, [
                    ...hand.slice(0, index),
                    ...hand.slice(index + 1),
                ]);
            }
        }
        const message: LobbyMessage = {
            type: "game-data",
            payload: { kind: "card-played", ...proposal },
        };
        broadcast(message);
        dispatch(message);
    }, [broadcast, dispatch]);

    const setRoster = useCallback((next: Player[]) => {
        playersRef.current = next;
        setPlayers(next);
    }, []);

    const broadcastRoster = useCallback(() => {
        broadcast({
            type: "lobby-state",
            players: playersRef.current,
            hostId: sessionIdRef.current ?? "",
            features: featuresRef.current,
        });
    }, [broadcast]);

    const updateRosterName = useCallback((playerId: string, characterName: string) => {
        setRoster(playersRef.current.map((player) =>
            player.id === playerId ? { ...player, characterName } : player
        ));
        broadcastRoster();
    }, [setRoster, broadcastRoster]);

    const recordMuteState = useCallback((playerId: string, muted: boolean) => {
        const current = unmutedPlayerIdsRef.current;
        const present = current.includes(playerId);
        const next = muted
            ? (present ? current.filter((id) => id !== playerId) : current)
            : (present ? current : [...current, playerId]);
        unmutedPlayerIdsRef.current = next;
        setUnmutedPlayerIds(next);
    }, []);

    const attachRemoteStream = useCallback((remoteId: string, stream: MediaStream) => {
        let audio = audioElementsRef.current.get(remoteId);
        if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            audioElementsRef.current.set(remoteId, audio);
        }
        audio.srcObject = stream;
        audio.play().catch(() => {
            // Autoplay may be blocked until the user interacts with the page.
        });
    }, []);

    const cleanupVoice = useCallback((remoteId: string) => {
        mediaConnectionsRef.current.delete(remoteId);
        pendingCallsRef.current.delete(remoteId);
        const audio = audioElementsRef.current.get(remoteId);
        if (audio) {
            audio.pause();
            audio.srcObject = null;
            audioElementsRef.current.delete(remoteId);
        }
    }, []);

    const closeVoiceConnection = useCallback((remoteId: string) => {
        const call = mediaConnectionsRef.current.get(remoteId)
            ?? pendingCallsRef.current.get(remoteId);
        cleanupVoice(remoteId);
        call?.close();
    }, [cleanupVoice]);

    const registerMediaConnection = useCallback((remoteId: string, call: MediaConnection) => {
        mediaConnectionsRef.current.set(remoteId, call);
        call.on("stream", (remote) => attachRemoteStream(remoteId, remote));
        call.on("close", () => cleanupVoice(remoteId));
    }, [attachRemoteStream, cleanupVoice]);

    const syncVoiceConnections = useCallback(() => {
        const peer = peerRef.current;
        const stream = localStreamRef.current;
        if (!featuresRef.current.voiceChat || !peer || !stream || peer.destroyed || !peer.id) return;
        const ownId = peer.id;

        // Answer calls that arrived before the microphone stream was ready.
        for (const [remoteId, call] of pendingCallsRef.current) {
            call.answer(stream);
            registerMediaConnection(remoteId, call);
        }
        pendingCallsRef.current.clear();

        for (const player of playersRef.current) {
            if (player.id === ownId || mediaConnectionsRef.current.has(player.id)) continue;
            if (ownId < player.id) {
                const call = peer.call(player.id, stream);
                registerMediaConnection(player.id, call);
            }
        }

        for (const remoteId of [...mediaConnectionsRef.current.keys()]) {
            if (!playersRef.current.some((player) => player.id === remoteId)) {
                closeVoiceConnection(remoteId);
            }
        }
    }, [registerMediaConnection, closeVoiceConnection]);

    const stopVoice = useCallback(() => {
        for (const remoteId of [
            ...mediaConnectionsRef.current.keys(),
            ...pendingCallsRef.current.keys(),
        ]) {
            closeVoiceConnection(remoteId);
        }
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        voiceStartedRef.current = false;
        isMutedRef.current = true;
        setIsMuted(true);
        unmutedPlayerIdsRef.current = [];
        setUnmutedPlayerIds([]);
        setVoiceError(null);
    }, [closeVoiceConnection]);

    const toggleMute = useCallback(() => {
        if (!featuresRef.current.voiceChat) return;
        const nextMuted = !isMutedRef.current;
        isMutedRef.current = nextMuted;
        setIsMuted(nextMuted);
        localStreamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = !nextMuted;
        });
        // Retry any audio blocked by autoplay policies now that we have a user gesture.
        for (const audio of audioElementsRef.current.values()) {
            audio.play().catch(() => {
                // Still blocked; will retry on the next toggle.
            });
        }

        const id = peerRef.current?.id;
        if (!id) return;
        recordMuteState(id, nextMuted);
        const message: LobbyMessage = { type: "mute-state", playerId: id, muted: nextMuted };
        if (roleRef.current === "host") {
            broadcast(message);
        } else {
            const hostConnection = connectionsRef.current.get(entryIdRef.current ?? "");
            if (hostConnection) send(hostConnection, message);
        }
    }, [broadcast, send, recordMuteState]);

    const applyGameProgress = useCallback((progress: Pick<GameState, "successes" | "currentEncounterIndex">) => {
        setGameState((current) => current ? { ...current, ...progress } : current);
    }, []);

    const playCard = useCallback((card: Action) => {
        setGameState((current) => {
            if (!current) return current;
            const index = current.hand.indexOf(card);
            if (index === -1) return current;
            const hand = [...current.hand];
            hand.splice(index, 1);
            return { ...current, hand };
        });
    }, []);

    // The host owns every player's hand, so only it can tell when all of them are empty.
    const everyoneOutOfCards = useCallback(() => {
        const currentPlayers = playersRef.current;
        return currentPlayers.length > 0 && currentPlayers.every((player) =>
            (handsRef.current.get(player.id)?.length ?? 1) === 0);
    }, []);

    useEffect(() => {
        let disposed = false;

        roleRef.current = null;
        leavingRef.current = false;
        activeProposalRef.current = null;
        voiceStartedRef.current = false;
        handsRef.current.clear();
        sessionIdRef.current = null;
        unmutedPlayerIdsRef.current = [];
        chatMessagesRef.current = [];

        let peer: Peer;
        let codeAttempts = 0;
        let assignedPeerId: string | undefined;
        let retryLoopActive = false;
        let retryAttempt = 0;
        let reconnectTimer: number | null = null;
        let heartbeatTimer: number | null = null;
        let pingSequence = 0;
        let rttEstimateMs = 0;
        let offline = typeof navigator !== "undefined" && !navigator.onLine;
        let hostConnectionWasLive = false;

        const peerOptions = {
            host: import.meta.env.VITE_PEER_HOST || "0.peerjs.com",
            port: Number(import.meta.env.VITE_PEER_PORT || 443),
            path: import.meta.env.VITE_PEER_PATH || "/",
            debug: Number(import.meta.env.VITE_PEER_DEBUG || 0),
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    {
                        urls: "turn:free.expressturn.com:3478",
                        username: "000000002108492650",
                        credential: "pGblr6Sgj6o6mLOJjl9QckoJlWY=",
                    },
                ],
            },
        };

        const connections = connectionsRef.current;
        const handlers = handlersRef.current;
        const lastPongAt = new Map<string, number>();
        const pendingPingAt = new Map<string, { id: number; sentAt: number }>();
        const rosterGraceTimers = new Map<string, number>();
        const reconnectingPlayers = new Set<string>();

        const clearRetryTimer = () => {
            if (reconnectTimer !== null) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        const cancelRosterGrace = (remoteId: string) => {
            const timer = rosterGraceTimers.get(remoteId);
            if (timer !== undefined) window.clearTimeout(timer);
            rosterGraceTimers.delete(remoteId);
            reconnectingPlayers.delete(remoteId);
        };

        const onRecoverySuccess = () => {
            if (disposed || leavingRef.current) return;
            clearRetryTimer();
            retryAttempt = 0;
            retryLoopActive = false;
            setStatus("connected");
            setError(null);
            setReconnect(null);
        };

        const buildSyncState = (remoteId: string): GameSyncState => {
            const snapshot = syncSourceRef.current?.() ?? null;
            const game = snapshot?.game ?? gameStateRef.current;
            const hand = handsRef.current.get(remoteId);
            return {
                game: game && hand ? { ...game, hand } : game,
                prep: snapshot?.prep ?? { step: 0, done: [], complete: false },
                questFailed: snapshot?.questFailed ?? null,
                proposal: snapshot?.proposal ?? null,
                votes: snapshot?.votes ?? [],
                result: snapshot?.result ?? null,
                passedEncounters: snapshot?.passedEncounters ?? [],
                currentAttempts: snapshot?.currentAttempts ?? [],
                lastEncounterIndex: snapshot?.lastEncounterIndex ?? 0,
                unmutedPlayerIds: unmutedPlayerIdsRef.current,
                chatMessages: chatMessagesRef.current,
            };
        };

        const sendSyncTo = (connection: DataConnection) => {
            send(connection, { type: "game-sync", sync: buildSyncState(connection.peer) });
        };

        const markPlayerConnected = (remoteId: string): boolean => {
            cancelRosterGrace(remoteId);
            const known = playersRef.current.some((player) => player.id === remoteId);
            setRoster(known
                ? playersRef.current.map((player) =>
                    player.id === remoteId ? { ...player, connected: true } : player)
                : [...playersRef.current, { id: remoteId, connected: true }]);
            return known;
        };

        const markPlayerReconnecting = (remoteId: string) => {
            if (rosterGraceTimers.has(remoteId)) return;
            reconnectingPlayers.add(remoteId);
            closeVoiceConnection(remoteId);
            setRoster(playersRef.current.map((player) =>
                player.id === remoteId ? { ...player, connected: false } : player));
            broadcastRoster();

            const timer = window.setTimeout(() => {
                rosterGraceTimers.delete(remoteId);
                if (disposed || leavingRef.current || roleRef.current !== "host") return;
                if (playersRef.current.some((player) =>
                    player.id === remoteId && player.connected === false)) {
                    reconnectingPlayers.delete(remoteId);
                    setRoster(playersRef.current.filter((player) => player.id !== remoteId));
                    broadcastRoster();
                }
            }, ROSTER_GRACE_MS);
            rosterGraceTimers.set(remoteId, timer);
        };

        const startVoice = () => {
            if (voiceStartedRef.current) return;
            voiceStartedRef.current = true;
            navigator.mediaDevices?.getUserMedia({ audio: true })
                .then((stream) => {
                    if (disposed) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }
                    stream.getAudioTracks().forEach((track) => { track.enabled = false; });
                    localStreamRef.current = stream;
                    syncVoiceConnections();
                })
                .catch(() => {
                    if (!disposed) setVoiceError("Microphone unavailable");
                });
        };

        const applyFeatures = (next: LobbyFeatures) => {
            const wasKnown = featuresKnownRef.current;
            featuresRef.current = next;
            featuresKnownRef.current = true;
            setFeatures(next);
            if (!next.voiceChat) {
                for (const remoteId of [...pendingCallsRef.current.keys()]) {
                    closeVoiceConnection(remoteId);
                }
            } else if (!wasKnown) {
                startVoice();
            }
        };

        const beginRetry = () => {
            if (disposed || leavingRef.current) return;
            if (!retryLoopActive) {
                retryLoopActive = true;
                retryAttempt = 0;
            }
            setError(null);
            setStatus("reconnecting");
            setReconnect({ attempt: Math.min(retryAttempt + 1, MAX_RECONNECT_ATTEMPTS), maxAttempts: MAX_RECONNECT_ATTEMPTS });
            scheduleRetry();
        };

        const scheduleRetry = (immediate = false) => {
            if (disposed || leavingRef.current || !retryLoopActive || reconnectTimer !== null) return;
            if (offline && !immediate) return;
            if (retryAttempt >= MAX_RECONNECT_ATTEMPTS) {
                setStatus("error");
                setError("Connection lost. Try again or leave the lobby.");
                setReconnect(null);
                return;
            }
            const delay = immediate ? 0 : Math.min(1000 * 2 ** retryAttempt, MAX_RECONNECT_DELAY_MS);
            setStatus("reconnecting");
            setReconnect({ attempt: retryAttempt + 1, maxAttempts: MAX_RECONNECT_ATTEMPTS });
            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = null;
                if (disposed || leavingRef.current || offline) return;
                retryAttempt += 1;
                attemptRecovery();
                scheduleRetry();
            }, delay);
        };

        const resetVoiceConnections = () => {
            for (const remoteId of [
                ...mediaConnectionsRef.current.keys(),
                ...pendingCallsRef.current.keys(),
            ]) {
                closeVoiceConnection(remoteId);
            }
        };

        const heartbeatTimeoutMs = () => Math.min(
            MAX_HEARTBEAT_TIMEOUT_MS,
            Math.max(MIN_HEARTBEAT_TIMEOUT_MS, rttEstimateMs * HEARTBEAT_RTT_FACTOR),
        );

        const heartbeatIntervalMs = () => Math.min(
            MAX_HEARTBEAT_INTERVAL_MS,
            Math.max(MIN_HEARTBEAT_INTERVAL_MS, heartbeatTimeoutMs() / 3),
        );

        const recordPong = (remoteId: string, id: number) => {
            const pending = pendingPingAt.get(remoteId);
            if (!pending || pending.id !== id) return;
            pendingPingAt.delete(remoteId);
            const rtt = Date.now() - pending.sentAt;
            if (rtt >= 0) {
                rttEstimateMs = rttEstimateMs === 0 ? rtt : rttEstimateMs * 0.7 + rtt * 0.3;
            }
        };

        const runHeartbeat = () => {
            const now = Date.now();
            const timeout = heartbeatTimeoutMs();
            for (const [remoteId, connection] of [...connections]) {
                if (!connection.open) continue;
                if (now - (lastPongAt.get(remoteId) ?? now) > timeout) {
                    connections.delete(remoteId);
                    lastPongAt.delete(remoteId);
                    pendingPingAt.delete(remoteId);
                    connection.close();
                    if (roleRef.current === "host") {
                        markPlayerReconnecting(remoteId);
                    } else if (remoteId === entryIdRef.current) {
                        closeVoiceConnection(remoteId);
                        hostConnectionWasLive = true;
                        beginRetry();
                    }
                } else {
                    const id = ++pingSequence;
                    pendingPingAt.set(remoteId, { id, sentAt: now });
                    send(connection, { type: "ping", id });
                }
            }
        };

        const scheduleHeartbeat = (delayMs?: number) => {
            if (heartbeatTimer !== null) window.clearTimeout(heartbeatTimer);
            if (disposed || leavingRef.current) return;
            heartbeatTimer = window.setTimeout(() => {
                heartbeatTimer = null;
                if (disposed || leavingRef.current || document.visibilityState === "hidden") return;
                runHeartbeat();
                scheduleHeartbeat();
            }, delayMs ?? heartbeatIntervalMs());
        };

        const handleVisibilityChange = () => {
            if (disposed || leavingRef.current) return;
            if (document.visibilityState === "hidden") {
                if (heartbeatTimer !== null) {
                    window.clearTimeout(heartbeatTimer);
                    heartbeatTimer = null;
                }
                return;
            }
            // Give everyone a fresh window instead of counting time spent hidden.
            const now = Date.now();
            for (const remoteId of connections.keys()) lastPongAt.set(remoteId, now);
            pendingPingAt.clear();
            scheduleHeartbeat(0);
        };

        const attemptRecovery = () => {
            if (disposed || leavingRef.current) return;
            const current = peerRef.current;
            try {
                if (!current || current.destroyed) {
                    createPeer(assignedPeerId ?? (entryIdRef.current ? undefined : generateLobbyCode()));
                } else if (current.disconnected) {
                    current.reconnect();
                } else if (current.open) {
                    recoverDataConnections();
                }
            } catch {
                // A failed synchronous attempt just falls through to the next retry.
            }
        };

        const recoverDataConnections = () => {
            const current = peerRef.current;
            if (!current || current.destroyed || current.disconnected || !current.open) return;
            if (roleRef.current === "guest") {
                const hostId = entryIdRef.current;
                if (!hostId) return;
                const existing = connections.get(hostId);
                if (existing?.open) {
                    if (hostConnectionWasLive) {
                        hostConnectionWasLive = false;
                        send(existing, { type: "resync-request", playerId: assignedPeerId ?? "" });
                    }
                    return;
                }
                if (existing) return; // Still connecting; wait for it to open or close.
                hostConnectionWasLive = true;
                registerConnection(current.connect(hostId));
                return;
            }
            if (roleRef.current === "host") {
                for (const [remoteId, connection] of [...connections]) {
                    if (!connection.open) {
                        connection.close();
                        connections.delete(remoteId);
                        lastPongAt.delete(remoteId);
                        pendingPingAt.delete(remoteId);
                        markPlayerReconnecting(remoteId);
                    }
                }
                broadcastRoster();
            }
        };

        const applyLobbySnapshot = (sync: GameSyncState) => {
            unmutedPlayerIdsRef.current = sync.unmutedPlayerIds;
            setUnmutedPlayerIds(sync.unmutedPlayerIds);
            chatMessagesRef.current = sync.chatMessages;
            setChatMessages(sync.chatMessages);
        };

        const handleMessage = (raw: unknown, from: DataConnection) => {
            if (disposed || !isLobbyMessage(raw)) return;
            const message = raw;
            lastPongAt.set(from.peer, Date.now());

            switch (message.type) {
                case "ping": {
                    send(from, { type: "pong", id: message.id });
                    break;
                }
                case "pong": {
                    recordPong(from.peer, message.id);
                    break;
                }
                case "resync-request": {
                    if (roleRef.current !== "host") break;
                    if (!playersRef.current.some((player) => player.id === message.playerId)) break;
                    sendSyncTo(from);
                    break;
                }
                case "game-sync": {
                    if (roleRef.current !== "guest") break;
                    applyLobbySnapshot(message.sync);
                    dispatch(message);
                    break;
                }
                case "join": {
                    if (roleRef.current !== "host") break;
                    const known = playersRef.current.some((p) => p.id === message.player.id);
                    markPlayerConnected(message.player.id);
                    if (known && handsRef.current.has(message.player.id)) sendSyncTo(from);
                    broadcastRoster();
                    break;
                }
                case "lobby-state": {
                    if (roleRef.current === "guest") {
                        applyFeatures(message.features);
                        setRoster(message.players);
                    }
                    break;
                }
                case "leave": {
                    if (roleRef.current !== "host") break;
                    cancelRosterGrace(message.playerId);
                    setRoster(playersRef.current.filter((p) => p.id !== message.playerId));
                    broadcastRoster();
                    break;
                }
                case "lobby-closed": {
                    if (roleRef.current === "guest") {
                        leavingRef.current = true;
                        navigateRef.current("/");
                    }
                    break;
                }
                case "mute-state": {
                    recordMuteState(message.playerId, message.muted);
                    if (roleRef.current === "host" && from.peer !== peer.id) {
                        for (const [id, connection] of connections) {
                            if (id !== from.peer) send(connection, message);
                        }
                    }
                    break;
                }
                case "chat": {
                    if (!featuresRef.current.textChat) break;
                    const next = [...chatMessagesRef.current, message.message];
                    chatMessagesRef.current = next;
                    setChatMessages(next);
                    if (roleRef.current === "host" && from.peer !== peer.id) {
                        for (const [id, connection] of connections) {
                            if (id !== from.peer) send(connection, message);
                        }
                    }
                    break;
                }
                case "start-game": {
                    if (roleRef.current === "guest") {
                        gameStateRef.current = message.game;
                        setGameState(message.game);
                        dispatch(message);
                        navigateRef.current("/game");
                    }
                    break;
                }
                case "game-data": {
                    const payload = message.payload;
                    if (payload.kind === "prep-name") {
                        // Character names are requests; the host owns and rebroadcasts the roster.
                        if (roleRef.current === "host") {
                            updateRosterName(payload.playerId, payload.characterName);
                        }
                        break;
                    }
                    if (payload.kind === "card-proposal") {
                        // Proposals are requests only; the host alone decides and announces the card.
                        if (roleRef.current === "host") {
                            acceptProposal({
                                proposalId: payload.proposalId,
                                proposerId: payload.proposerId,
                                card: payload.card,
                            });
                        }
                        break;
                    }
                    // Guests send other game data to the host, which relays it to the others.
                    if (roleRef.current === "host" && from.peer !== peer.id) {
                        for (const [id, connection] of connections) {
                            if (id !== from.peer) send(connection, message);
                        }
                    }
                    dispatch(message);
                    break;
                }
            }
        };

        const registerConnection = (connection: DataConnection) => {
            const remoteId = connection.peer;
            connections.set(remoteId, connection);
            lastPongAt.set(remoteId, Date.now());

            connection.on("open", () => {
                if (disposed || leavingRef.current) return;
                if (roleRef.current === "host") {
                    const wasReconnecting = reconnectingPlayers.delete(remoteId);
                    markPlayerConnected(remoteId);
                    broadcastRoster();
                    if (wasReconnecting || handsRef.current.has(remoteId)) sendSyncTo(connection);
                } else if (roleRef.current === "guest") {
                    send(connection, { type: "join", player: { id: assignedPeerId ?? peer.id ?? "" } });
                    if (hostConnectionWasLive) {
                        hostConnectionWasLive = false;
                        send(connection, { type: "resync-request", playerId: assignedPeerId ?? "" });
                    }
                    onRecoverySuccess();
                }
            });

            connection.on("data", (data) => handleMessage(data, connection));

            connection.on("close", () => {
                connections.delete(remoteId);
                lastPongAt.delete(remoteId);
                pendingPingAt.delete(remoteId);
                if (disposed || leavingRef.current) return;
                if (roleRef.current === "host") {
                    markPlayerReconnecting(remoteId);
                } else if (remoteId === entryIdRef.current) {
                    closeVoiceConnection(remoteId);
                    hostConnectionWasLive = true;
                    beginRetry();
                }
            });

            connection.on("error", (err) => {
                if (disposed || leavingRef.current) return;
                const type = String(err.type);
                if (isTransientError(type)) {
                    beginRetry();
                } else {
                    setStatus("error");
                    setError(err.message || type);
                }
            });
        };

        const createPeer = (id?: string) => {
            const nextPeer = id ? new Peer(id, peerOptions) : new Peer(peerOptions);
            peer = nextPeer;
            peerRef.current = nextPeer;
            if (id) {
                assignedPeerId = id;
                sessionIdRef.current = id;
            }

            nextPeer.on("open", (openedId) => {
                if (disposed || peer !== nextPeer) return;
                assignedPeerId = openedId;
                sessionIdRef.current = openedId;
                setPeerId(openedId);
                onRecoverySuccess();

                if (featuresRef.current.voiceChat) startVoice();

                if (roleRef.current === null) {
                    const entry = entryIdRef.current;
                    if (entry) {
                        roleRef.current = "guest";
                        setRole("guest");
                        setHostId(entry);
                        registerConnection(nextPeer.connect(entry));
                    } else {
                        roleRef.current = "host";
                        setRole("host");
                        setHostId(openedId);
                        setRoster([{ id: openedId, connected: true }]);
                    }
                    return;
                }

                // Signaling is back. P2P links may or may not have survived; refresh everything.
                resetVoiceConnections();
                if (roleRef.current === "host") {
                    for (const connection of connections.values()) sendSyncTo(connection);
                    broadcastRoster();
                } else {
                    hostConnectionWasLive = true;
                }
                recoverDataConnections();
                syncVoiceConnections();
            });

            nextPeer.on("connection", (connection) => {
                if (disposed || peer !== nextPeer) return;
                if (roleRef.current === "host") {
                    registerConnection(connection);
                } else {
                    connection.close();
                }
            });

            nextPeer.on("call", (call) => {
                if (disposed || peer !== nextPeer) return;
                if (featuresKnownRef.current && !featuresRef.current.voiceChat) {
                    call.close();
                    return;
                }
                const remoteId = call.peer;
                if (mediaConnectionsRef.current.has(remoteId) || pendingCallsRef.current.has(remoteId)) {
                    closeVoiceConnection(remoteId);
                }
                const stream = localStreamRef.current;
                if (!stream) {
                    pendingCallsRef.current.set(remoteId, call);
                    call.on("close", () => pendingCallsRef.current.delete(remoteId));
                    return;
                }
                call.answer(stream);
                registerMediaConnection(remoteId, call);
            });

            nextPeer.on("error", (err) => {
                if (disposed || peer !== nextPeer) return;
                const errorType: string = err.type;
                if ((errorType === "unavailable-id" || errorType === "peer-id-in-use")
                    && !entryIdRef.current && roleRef.current === null && codeAttempts < MAX_CODE_ATTEMPTS) {
                    codeAttempts += 1;
                    // Replace first so the failed peer's close/error events are ignored.
                    createPeer(generateLobbyCode());
                    if (!nextPeer.destroyed) nextPeer.destroy();
                    return;
                }
                if (isTransientError(errorType)
                    || (roleRef.current !== null && (errorType === "unavailable-id" || errorType === "peer-id-in-use"))) {
                    beginRetry();
                    return;
                }
                setStatus("error");
                setError(err.message || errorType);
            });

            nextPeer.on("close", () => {
                if (!disposed && !leavingRef.current && peer === nextPeer) beginRetry();
            });

            nextPeer.on("disconnected", () => {
                if (!disposed && !leavingRef.current && peer === nextPeer) beginRetry();
            });
        };

        retryNowRef.current = () => {
            if (disposed || leavingRef.current) return;
            retryAttempt = 0;
            retryLoopActive = true;
            clearRetryTimer();
            attemptRecovery();
            scheduleRetry();
        };

        const handleOffline = () => {
            // Pause the retry loop; the online handler resumes it.
            offline = true;
            clearRetryTimer();
        };

        const handleOnline = () => {
            offline = false;
            if (!retryLoopActive || disposed || leavingRef.current) return;
            retryAttempt = 0;
            attemptRecovery();
            scheduleRetry();
        };

        window.addEventListener("offline", handleOffline);
        window.addEventListener("online", handleOnline);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        if (document.visibilityState !== "hidden") scheduleHeartbeat();

        createPeer(entryIdRef.current ? undefined : generateLobbyCode());

        return () => {
            disposed = true;
            leavingRef.current = true;
            clearRetryTimer();
            if (heartbeatTimer !== null) window.clearTimeout(heartbeatTimer);
            for (const timer of rosterGraceTimers.values()) window.clearTimeout(timer);
            rosterGraceTimers.clear();
            reconnectingPlayers.clear();
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("online", handleOnline);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            retryNowRef.current = null;
            syncSourceRef.current = null;
            if (!peer.destroyed) peer.destroy();
            peerRef.current = null;
            activeProposalRef.current = null;
            stopVoice();
            setChatMessages([]);
            chatMessagesRef.current = [];
            handsRef.current.clear();
            sessionIdRef.current = null;
            lastPongAt.clear();
            pendingPingAt.clear();
            connections.clear();
            handlers.clear();
        };
    }, [
        dispatch, send, broadcastRoster, setRoster, acceptProposal, updateRosterName,
        recordMuteState, attachRemoteStream, cleanupVoice, closeVoiceConnection,
        registerMediaConnection, syncVoiceConnections, stopVoice,
    ]);

    useEffect(() => {
        syncVoiceConnections();
    }, [players, syncVoiceConnections]);

    const startGame = useCallback(() => {
        if (roleRef.current !== "host") return;
        activeProposalRef.current = null;
        // Each new game starts with fresh character names.
        setRoster(playersRef.current.map(({ id }) => ({ id, connected: true })));
        broadcastRoster();
        const drawnEncounters = createEncounters();
        const quest = createQuest();
        const hands = new Map(playersRef.current.map((player) => [player.id, createHand()]));
        handsRef.current = hands;
        const ownHand = hands.get(peerRef.current?.id ?? "")!;

        // Each player gets their own hand; the encounters and quest are shared.
        for (const [id, connection] of connectionsRef.current) {
            const game = createGameState(hands.get(id)!, drawnEncounters, quest);
            send(connection, { type: "start-game", game });
        }

        const game = createGameState(ownHand, drawnEncounters, quest);
        const message: LobbyMessage = { type: "start-game", game };
        syncGameState(game);
        dispatch(message);
        navigateRef.current("/game");
    }, [dispatch, send, setRoster, broadcastRoster, syncGameState]);

    const leaveLobby = useCallback(() => {
        leavingRef.current = true;
        const message: LobbyMessage =
            roleRef.current === "host"
                ? { type: "lobby-closed" }
                : { type: "leave", playerId: peerRef.current?.id ?? "" };
        broadcast(message);
        for (const connection of connectionsRef.current.values()) {
            connection.close({ flush: true });
        }
        connectionsRef.current.clear();
        const peer = peerRef.current;
        if (peer && !peer.destroyed) peer.destroy();
        peerRef.current = null;
        navigateRef.current("/");
    }, [broadcast]);

    const subscribe = useCallback((handler: (message: LobbyMessage) => void) => {
        handlersRef.current.add(handler);
        return () => {
            handlersRef.current.delete(handler);
        };
    }, []);

    const sendGameData = useCallback((payload: GameDataPayload) => {
        if (roleRef.current === "host" && payload.kind === "vote-result") {
            activeProposalRef.current = null;
        }
        const message: LobbyMessage = { type: "game-data", payload };
        broadcast(message);
        dispatch(message);
    }, [broadcast, dispatch]);

    const proposeCard = useCallback((card: Action) => {
        const proposal: Proposal = {
            proposalId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            proposerId: peerRef.current?.id ?? "",
            card,
        };

        if (roleRef.current === "host") {
            acceptProposal(proposal);
            return;
        }

        const hostConnection = connectionsRef.current.get(entryIdRef.current ?? "");
        if (hostConnection) {
            send(hostConnection, {
                type: "game-data",
                payload: { kind: "card-proposal", ...proposal },
            });
        }
    }, [acceptProposal, send]);

    const setCharacterName = useCallback((characterName: string) => {
        const trimmed = characterName.trim();
        const id = peerRef.current?.id;
        if (!trimmed || !id) return;

        if (roleRef.current === "host") {
            updateRosterName(id, trimmed);
            return;
        }

        const hostConnection = connectionsRef.current.get(entryIdRef.current ?? "");
        if (hostConnection) {
            send(hostConnection, {
                type: "game-data",
                payload: { kind: "prep-name", playerId: id, characterName: trimmed },
            });
        }
    }, [updateRosterName, send]);

    const clearCharacterName = useCallback((playerId: string) => {
        if (roleRef.current !== "host") return;
        setRoster(playersRef.current.map((player) =>
            player.id === playerId ? { ...player, characterName: undefined } : player
        ));
        broadcastRoster();
        sendGameData({ kind: "prep-name-reset", playerId });
    }, [setRoster, broadcastRoster, sendGameData]);

    const sendChat = useCallback((text: string) => {
        if (!featuresRef.current.textChat) return;
        const trimmed = text.trim();
        const id = peerRef.current?.id;
        if (!trimmed || !id) return;

        const chatMessage: ChatMessage = {
            id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            senderId: id,
            text: trimmed,
            timestamp: Date.now(),
        };
        const next = [...chatMessagesRef.current, chatMessage];
        chatMessagesRef.current = next;
        setChatMessages(next);

        const message: LobbyMessage = { type: "chat", message: chatMessage };
        if (roleRef.current === "host") {
            broadcast(message);
        } else {
            const hostConnection = connectionsRef.current.get(entryIdRef.current ?? "");
            if (hostConnection) send(hostConnection, message);
        }
    }, [broadcast, send]);

    const retryNow = useCallback(() => {
        retryNowRef.current?.();
    }, []);

    const value: PeerContextValue = {
        status,
        peerId,
        role,
        players,
        hostId,
        error,
        reconnect,
        retryNow,
        gameState,
        syncGameState,
        registerSyncSource,
        applyGameProgress,
        playCard,
        everyoneOutOfCards,
        setCharacterName,
        clearCharacterName,
        isMuted,
        toggleMute,
        unmutedPlayerIds,
        voiceError,
        chatMessages,
        sendChat,
        features,
        startGame,
        leaveLobby,
        subscribe,
        sendGameData,
        proposeCard,
    };

    return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
}
