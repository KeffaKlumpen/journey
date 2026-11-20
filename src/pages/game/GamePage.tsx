import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { DICE_COUNT, resolveEncounter, rollDice } from "../../game/rules";
import { usePeer } from "../../net/peer-context";
import {
    isGameDataPayload,
    VOTE_OPTIONS,
    type Player,
    type VoteOption,
} from "../../net/messages";
import CardPopup from "../components/CardPopup";
import EncounterCard from "../components/EncounterCard";
import Hand from "../components/Hand";
import PlayerList from "../components/PlayerList";
import ResultPopup, { type DiceRoll } from "../components/ResultPopup";
import GameOverPopup from "../components/GameOverPopup";
import "./game.css";

type Proposal = {
    id: string;
    proposerId: string;
    card: string;
};

type Vote = {
    proposalId: string;
    voterId: string;
    vote: VoteOption;
};

type PendingRoll = Proposal & {
    result: VoteOption;
};

type Result = PendingRoll & {
    roll?: DiceRoll & { gameOver: boolean };
};

const VOTE_VALUES: Record<VoteOption, number> = {
    BAD: 0,
    OK: 1,
    GOOD: 2,
    GREAT: 3,
};

function decideResult(votes: Vote[]): VoteOption {
    if (votes.length === 0) return "OK";

    const average = votes.reduce((sum, vote) => sum + VOTE_VALUES[vote.vote], 0) / votes.length;
    return VOTE_OPTIONS[Math.round(average)] ?? "OK";
}

function GamePage() {
    const { gameState, players, peerId, hostId, role, subscribe, sendGameData, applyGameProgress, proposeCard, playCard } = usePeer();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [rollRequested, setRollRequested] = useState(false);

    const proposalRef = useRef<Proposal | null>(null);
    const votesRef = useRef<Vote[]>([]);
    const hasVotedRef = useRef(false);
    const pendingRollRef = useRef<PendingRoll | null>(null);
    const rollRequestedRef = useRef(false);
    const playersRef = useRef<Player[]>(players);
    const gameStateRef = useRef(gameState);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (!gameState) {
            navigate("/", { replace: true });
        }
    }, [gameState, navigate]);

    const clearProposal = () => {
        proposalRef.current = null;
        votesRef.current = [];
        hasVotedRef.current = false;
        setProposal(null);
        setVotes([]);
        setHasVoted(false);
    };

    const resetRoll = () => {
        rollRequestedRef.current = false;
        setRollRequested(false);
    };

    useEffect(() => subscribe((message) => {
        if (message.type !== "game-data" || !isGameDataPayload(message.payload)) return;
        const payload = message.payload;

        if (payload.kind === "card-played") {
            if (payload.proposerId === peerId) {
                playCard(payload.card);
            }
            pendingRollRef.current = null;
            resetRoll();
            const next: Proposal = {
                id: payload.proposalId,
                proposerId: payload.proposerId,
                card: payload.card,
            };
            proposalRef.current = next;
            votesRef.current = [];
            hasVotedRef.current = false;
            setResult(null);
            setProposal(next);
            setVotes([]);
            setHasVoted(false);
            return;
        }

        if (payload.kind === "card-vote") {
            const alreadyVoted = votesRef.current.some((vote) =>
                vote.proposalId === payload.proposalId && vote.voterId === payload.voterId
            );
            const next = alreadyVoted
                ? votesRef.current
                : [...votesRef.current, {
                    proposalId: payload.proposalId,
                    voterId: payload.voterId,
                    vote: payload.vote,
                }];
            votesRef.current = next;
            setVotes(next);

            const current = proposalRef.current;
            if (role !== "host" || !current || current.id !== payload.proposalId) return;
            const others = playersRef.current.filter((player) => player.id !== current.proposerId);
            const voters = new Set(next
                .filter((vote) => vote.proposalId === current.id)
                .map((vote) => vote.voterId));
            if (others.length === 0 || others.every((player) => voters.has(player.id))) {
                const outcome = decideResult(next.filter((vote) => vote.proposalId === current.id));
                const pending: PendingRoll = {
                    id: current.id,
                    proposerId: current.proposerId,
                    card: current.card,
                    result: outcome,
                };
                pendingRollRef.current = pending;
                clearProposal();
                resetRoll();
                sendGameData({
                    kind: "vote-result",
                    proposalId: pending.id,
                    proposerId: pending.proposerId,
                    card: pending.card,
                    result: pending.result,
                });
            }
            return;
        }

        if (payload.kind === "vote-result") {
            clearProposal();
            resetRoll();
            setResult({
                id: payload.proposalId,
                proposerId: payload.proposerId,
                card: payload.card,
                result: payload.result,
            });
            return;
        }

        if (payload.kind === "roll-request") {
            if (role !== "host") return;
            const pending = pendingRollRef.current;
            if (!pending || pending.id !== payload.proposalId || pending.proposerId !== payload.proposerId) return;
            const game = gameStateRef.current;
            if (!game) return;

            pendingRollRef.current = null;
            const dice = rollDice(DICE_COUNT[pending.result]);
            const resolution = resolveEncounter(
                game.successes,
                dice,
                game.currentEncounterIndex,
                game.encounters.length
            );
            gameStateRef.current = {
                ...game,
                successes: resolution.successes,
                currentEncounterIndex: resolution.currentEncounterIndex,
            };
            applyGameProgress({
                successes: resolution.successes,
                currentEncounterIndex: resolution.currentEncounterIndex,
            });
            sendGameData({
                kind: "dice-result",
                proposalId: pending.id,
                proposerId: pending.proposerId,
                card: pending.card,
                result: pending.result,
                dice,
                gained: resolution.gained,
                encounterSuccesses: resolution.encounterSuccesses,
                successes: resolution.successes,
                currentEncounterIndex: resolution.currentEncounterIndex,
                gameOver: resolution.gameOver,
            });
            return;
        }

        if (payload.kind === "dice-result") {
            const currentGame = gameStateRef.current;
            if (currentGame) {
                gameStateRef.current = {
                    ...currentGame,
                    successes: payload.successes,
                    currentEncounterIndex: payload.currentEncounterIndex,
                };
            }
            applyGameProgress({
                successes: payload.successes,
                currentEncounterIndex: payload.currentEncounterIndex,
            });
            resetRoll();
            setResult({
                id: payload.proposalId,
                proposerId: payload.proposerId,
                card: payload.card,
                result: payload.result,
                roll: {
                    dice: payload.dice,
                    gained: payload.gained,
                    encounterSuccesses: payload.encounterSuccesses,
                    gameOver: payload.gameOver,
                },
            });
        }
    }), [subscribe, role, peerId, sendGameData, applyGameProgress, playCard]);

    const handleCardClick = (card: string) => {
        if (proposalRef.current || result) return;
        proposeCard(card);
    };

    const handleVote = (vote: VoteOption) => {
        if (!proposal || proposal.proposerId === peerId) return;
        sendGameData({
            kind: "card-vote",
            proposalId: proposal.id,
            voterId: peerId ?? "",
            vote,
        });
        hasVotedRef.current = true;
        setHasVoted(true);
    };

    const handleRoll = () => {
        if (!result || result.roll || result.proposerId !== peerId || rollRequestedRef.current) return;
        rollRequestedRef.current = true;
        setRollRequested(true);
        sendGameData({
            kind: "roll-request",
            proposalId: result.id,
            proposerId: peerId ?? "",
        });
    };

    if (!gameState) {
        return null;
    }

    const encounter = gameState.encounters[gameState.currentEncounterIndex];
    const otherPlayers = proposal
        ? players.filter((player) => player.id !== proposal.proposerId)
        : [];
    const votesReceived = proposal
        ? new Set(votes
            .filter((vote) => vote.proposalId === proposal.id)
            .map((vote) => vote.voterId)).size
        : 0;

    return (
        <div className="game-layout">
            <aside className="player-sidebar">
                <PlayerList players={players} peerId={peerId} hostId={hostId} />
            </aside>
            <main className="game-board">
                <EncounterCard encounter={encounter} successes={gameState.successes}></EncounterCard>
                <Hand cards={gameState.hand} onCardClick={handleCardClick}></Hand >
            </main>
            {result?.roll?.gameOver ? (
                <GameOverPopup
                    card={result.card}
                    result={result.result}
                    roll={result.roll}
                    onClose={() => setResult(null)}
                />
            ) : result ? (
                <ResultPopup
                    card={result.card}
                    result={result.result}
                    proposerId={result.proposerId}
                    peerId={peerId}
                    canRoll={result.proposerId === peerId && !result.roll && !rollRequested}
                    roll={result.roll}
                    onRoll={handleRoll}
                    onClose={() => setResult(null)}
                />
            ) : proposal ? (
                <CardPopup
                    card={proposal.card}
                    isProposer={proposal.proposerId === peerId}
                    isWaiting={hasVoted}
                    votesReceived={votesReceived}
                    totalVoters={otherPlayers.length}
                    onVote={handleVote}
                />
            ) : null}
        </div>
    )
}

export default GamePage;
