import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { Peer, type DataConnection } from "peerjs";
import { useNavigate, useSearchParams } from "react-router";
import { createEncounters, createGameState, createHand, type GameState } from "../game/game-state";
import { isLobbyMessage, type GameDataPayload, type LobbyMessage, type Player } from "./messages";
import { PeerContext, type PeerContextValue, type Role, type Status } from "./peer-context";

export function PeerProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const navigateRef = useRef(navigate);
    const [searchParams] = useSearchParams();
    const entryIdRef = useRef<string | null>(searchParams.get("entry"));

    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate]);

    const peerRef = useRef<Peer | null>(null);
    const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const roleRef = useRef<Role>(null);
    const playersRef = useRef<Player[]>([]);
    const leavingRef = useRef(false);
    const handlersRef = useRef<Set<(message: LobbyMessage) => void>>(new Set());

    const [status, setStatus] = useState<Status>("connecting");
    const [peerId, setPeerId] = useState<string | undefined>(undefined);
    const [role, setRole] = useState<Role>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [hostId, setHostId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [gameState, setGameState] = useState<PeerContextValue["gameState"]>(null);

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

    const setRoster = useCallback((next: Player[]) => {
        playersRef.current = next;
        setPlayers(next);
    }, []);

    const broadcastRoster = useCallback(() => {
        broadcast({
            type: "lobby-state",
            players: playersRef.current,
            hostId: peerRef.current?.id ?? "",
        });
    }, [broadcast]);

    const applyGameProgress = useCallback((progress: Pick<GameState, "successes" | "currentEncounterIndex">) => {
        setGameState((current) => current ? { ...current, ...progress } : current);
    }, []);

    useEffect(() => {
        let disposed = false;

        roleRef.current = null;
        leavingRef.current = false;

        const peer = new Peer({
            host: "localhost",
            port: 9000,
            path: "/myapp",
            debug: 3,
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
                case "start-game": {
                    if (roleRef.current === "guest") {
                        setGameState(message.game);
                        dispatch(message);
                        navigateRef.current("/game");
                    }
                    break;
                }
                case "game-data": {
                    // Guests send game data to the host, which relays it to the others.
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
            connections.clear();
            handlers.clear();
        };
    }, [dispatch, send, broadcastRoster, setRoster]);

    const startGame = useCallback(() => {
        if (roleRef.current !== "host") return;
        const drawnEncounters = createEncounters();
        const hands = new Map(playersRef.current.map((player) => [player.id, createHand()]));
        const ownHand = hands.get(peerRef.current?.id ?? "")!;

        // Each player gets their own hand; the encounters are shared.
        for (const [id, connection] of connectionsRef.current) {
            const game = createGameState(hands.get(id)!, drawnEncounters);
            send(connection, { type: "start-game", game });
        }

        const game = createGameState(ownHand, drawnEncounters);
        const message: LobbyMessage = { type: "start-game", game };
        setGameState(game);
        dispatch(message);
        navigateRef.current("/game");
    }, [dispatch, send]);

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
        const message: LobbyMessage = { type: "game-data", payload };
        broadcast(message);
        dispatch(message);
    }, [broadcast, dispatch]);

    const value: PeerContextValue = {
        status,
        peerId,
        role,
        players,
        hostId,
        error,
        gameState,
        applyGameProgress,
        startGame,
        leaveLobby,
        subscribe,
        sendGameData,
    };

    return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
}
