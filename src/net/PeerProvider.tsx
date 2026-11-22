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
import { isLobbyMessage, type ChatMessage, type GameDataPayload, type LobbyFeatures, type LobbyMessage, type Player } from "./messages";
import { PeerContext, type PeerContextValue, type Role, type Status } from "./peer-context";

type Proposal = Omit<Extract<GameDataPayload, { kind: "card-played" }>, "kind">;

function featureEnabled(value: string | null): boolean {
    return value !== "0";
}

export function PeerProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const navigateRef = useRef(navigate);
    const [searchParams] = useSearchParams();
    const entryId = searchParams.get("entry");
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

    const [status, setStatus] = useState<Status>("connecting");
    const [peerId, setPeerId] = useState<string | undefined>(undefined);
    const [role, setRole] = useState<Role>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [hostId, setHostId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [gameState, setGameState] = useState<PeerContextValue["gameState"]>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [unmutedPlayerIds, setUnmutedPlayerIds] = useState<string[]>([]);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

    // Only the host accepts proposals, so there is a single active vote at a time.
    const acceptProposal = useCallback((proposal: Proposal) => {
        if (activeProposalRef.current) return;
        activeProposalRef.current = proposal;
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
            hostId: peerRef.current?.id ?? "",
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
        setUnmutedPlayerIds((current) => {
            const present = current.includes(playerId);
            if (muted) return present ? current.filter((id) => id !== playerId) : current;
            return present ? current : [...current, playerId];
        });
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
        if (!featuresRef.current.voiceChat || !peer || !stream || peer.destroyed) return;
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

    useEffect(() => {
        let disposed = false;

        roleRef.current = null;
        leavingRef.current = false;
        activeProposalRef.current = null;
        voiceStartedRef.current = false;

        const peer = new Peer({
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
        });
        peerRef.current = peer;

        const connections = connectionsRef.current;
        const handlers = handlersRef.current;

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

        const handleMessage = (raw: unknown, from: DataConnection) => {
            if (disposed || !isLobbyMessage(raw)) return;
            const message = raw;

            switch (message.type) {
                case "join": {
                    if (roleRef.current !== "host") break;
                    if (!playersRef.current.some((p) => p.id === message.player.id)) {
                        setRoster([...playersRef.current, message.player]);
                    }
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
                    setChatMessages((current) => [...current, message.message]);
                    if (roleRef.current === "host" && from.peer !== peer.id) {
                        for (const [id, connection] of connections) {
                            if (id !== from.peer) send(connection, message);
                        }
                    }
                    break;
                }
                case "start-game": {
                    if (roleRef.current === "guest") {
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

            connection.on("open", () => {
                if (disposed) return;
                if (roleRef.current === "host") {
                    if (!playersRef.current.some((p) => p.id === remoteId)) {
                        setRoster([...playersRef.current, { id: remoteId }]);
                    }
                    broadcastRoster();
                } else if (roleRef.current === "guest") {
                    send(connection, { type: "join", player: { id: peer.id } });
                }
            });

            connection.on("data", (data) => handleMessage(data, connection));

            connection.on("close", () => {
                connections.delete(remoteId);
                if (disposed || leavingRef.current) return;
                if (roleRef.current === "host") {
                    setRoster(playersRef.current.filter((p) => p.id !== remoteId));
                    broadcastRoster();
                } else if (remoteId === entryIdRef.current) {
                    setError("The host left the lobby.");
                    setStatus("disconnected");
                    navigateRef.current("/");
                }
            });

            connection.on("error", (err) => {
                if (!disposed) setError(err.type);
            });
        };

        peer.on("open", (id) => {
            if (disposed) return;
            setPeerId(id);
            setStatus("connected");

            if (featuresRef.current.voiceChat) startVoice();

            const entry = entryIdRef.current;
            if (entry) {
                roleRef.current = "guest";
                setRole("guest");
                setHostId(entry);
                registerConnection(peer.connect(entry));
            } else {
                roleRef.current = "host";
                setRole("host");
                setHostId(id);
                setRoster([{ id }]);
            }
        });

        peer.on("connection", (connection) => {
            if (disposed) return;
            if (roleRef.current === "host") {
                registerConnection(connection);
            } else {
                connection.close();
            }
        });

        peer.on("call", (call) => {
            if (disposed) return;
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

        peer.on("error", (err) => {
            if (disposed) return;
            setStatus("error");
            setError(err.message || err.type);
        });

        peer.on("close", () => {
            if (!disposed) setStatus("disconnected");
        });

        peer.on("disconnected", () => {
            if (!disposed) setStatus("disconnected");
        });

        return () => {
            disposed = true;
            leavingRef.current = true;
            if (!peer.destroyed) peer.destroy();
            peerRef.current = null;
            activeProposalRef.current = null;
            stopVoice();
            setChatMessages([]);
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
        setRoster(playersRef.current.map(({ id }) => ({ id })));
        broadcastRoster();
        const drawnEncounters = createEncounters();
        const quest = createQuest();
        const hands = new Map(playersRef.current.map((player) => [player.id, createHand()]));
        const ownHand = hands.get(peerRef.current?.id ?? "")!;

        // Each player gets their own hand; the encounters and quest are shared.
        for (const [id, connection] of connectionsRef.current) {
            const game = createGameState(hands.get(id)!, drawnEncounters, quest);
            send(connection, { type: "start-game", game });
        }

        const game = createGameState(ownHand, drawnEncounters, quest);
        const message: LobbyMessage = { type: "start-game", game };
        setGameState(game);
        dispatch(message);
        navigateRef.current("/game");
    }, [dispatch, send, setRoster, broadcastRoster]);

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
        setChatMessages((current) => [...current, chatMessage]);

        const message: LobbyMessage = { type: "chat", message: chatMessage };
        if (roleRef.current === "host") {
            broadcast(message);
        } else {
            const hostConnection = connectionsRef.current.get(entryIdRef.current ?? "");
            if (hostConnection) send(hostConnection, message);
        }
    }, [broadcast, send]);

    const value: PeerContextValue = {
        status,
        peerId,
        role,
        players,
        hostId,
        error,
        gameState,
        applyGameProgress,
        playCard,
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
