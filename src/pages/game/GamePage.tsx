import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Action } from "../../game/card-data";
import { getHint } from "../../game/hints";
import { DICE_COUNT, resolveEncounter, rollDice } from "../../game/rules";
import { usePeer } from "../../net/peer-context";
import {
    isGameDataPayload,
    VOTE_OPTIONS,
    type GameSyncState,
    type Player,
    type VoteOption,
} from "../../net/messages";
import AudioControls from "../components/AudioControls";
import CardPopup from "../components/CardPopup";
import ConnectionBanner from "../components/ConnectionBanner";
import ChatWindow from "../components/ChatWindow";
import EncounterCard from "../components/EncounterCard";
import Hand from "../components/Hand";
import PlayerList from "../components/PlayerList";
import PrepPhase from "../components/PrepPhase";
import QuestSidebar, { type ActionAttempt, type PassedEncounter } from "../components/QuestSidebar";
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

const PREP_PROMPTS = [
    "Why is this quest important?",
    "Who are you, as a group?",
    "Who are you, as an individual?",
];

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
    const { gameState, players, peerId, hostId, role, features, subscribe, sendGameData, applyGameProgress, syncGameState, registerSyncSource, proposeCard, playCard, setCharacterName: submitCharacterName, clearCharacterName } = usePeer();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [rollRequested, setRollRequested] = useState(false);
    const [prepStep, setPrepStep] = useState(0);
    const [prepDone, setPrepDone] = useState<string[]>([]);
    const [prepComplete, setPrepComplete] = useState(false);
    const [passedEncounters, setPassedEncounters] = useState<PassedEncounter[]>([]);
    const [characterNameInput, setCharacterNameInput] = useState("");

    const currentAttemptsRef = useRef<ActionAttempt[]>([]);
    const passedEncountersRef = useRef<PassedEncounter[]>([]);
    const lastEncounterIndexRef = useRef(0);
    const prepStepRef = useRef(0);
    const prepDoneRef = useRef<string[]>([]);
    const prepCompleteRef = useRef(false);
    const proposalRef = useRef<Proposal | null>(null);
    const votesRef = useRef<Vote[]>([]);
    const hasVotedRef = useRef(false);
    const pendingRollRef = useRef<PendingRoll | null>(null);
    const rollRequestedRef = useRef(false);
    const playersRef = useRef<Player[]>(players);
    const gameStateRef = useRef(gameState);
    const resultRef = useRef<Result | null>(null);

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

    const tryAdvancePrep = useCallback(() => {
        if (role !== "host" || prepCompleteRef.current) return;
        const currentPlayers = playersRef.current;
        if (currentPlayers.length === 0) return;
        if (!currentPlayers.every((player) => prepDoneRef.current.includes(player.id))) return;

        if (prepStepRef.current < PREP_PROMPTS.length - 1) {
            sendGameData({ kind: "prep-advance", step: prepStepRef.current + 1 });
        } else {
            prepCompleteRef.current = true;
            setPrepComplete(true);
            sendGameData({ kind: "prep-complete" });
        }
    }, [role, sendGameData]);

    useEffect(() => {
        tryAdvancePrep();
    }, [players, tryAdvancePrep]);

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

    const setResultState = (next: Result | null) => {
        resultRef.current = next;
        setResult(next);
    };

    const buildSyncState = useCallback((): GameSyncState | null => {
        const game = gameStateRef.current;
        if (!game) return null;
        const proposal = proposalRef.current;
        const result = resultRef.current;
        return {
            game,
            prep: {
                step: prepStepRef.current,
                done: prepDoneRef.current,
                complete: prepCompleteRef.current,
            },
            proposal: proposal
                ? { proposalId: proposal.id, proposerId: proposal.proposerId, card: proposal.card as Action }
                : null,
            votes: votesRef.current.map((vote) => ({ ...vote })),
            result: result ? {
                proposalId: result.id,
                proposerId: result.proposerId,
                card: result.card as Action,
                result: result.result,
                roll: result.roll,
            } : null,
            passedEncounters: passedEncountersRef.current.map(({ encounter, attempts }) => ({
                encounter,
                attempts: attempts.map((attempt) => ({ ...attempt })),
            })),
            currentAttempts: currentAttemptsRef.current.map((attempt) => ({ ...attempt })),
            lastEncounterIndex: lastEncounterIndexRef.current,
            // The provider fills these in from its own authoritative state.
            unmutedPlayerIds: [],
            chatMessages: [],
        };
    }, []);

    useEffect(() => registerSyncSource(buildSyncState), [registerSyncSource, buildSyncState]);

    // A vote stays open while a player is reconnecting. When the roster settles,
    // decide using the votes that did arrive.
    const decideVoteIfComplete = useCallback(() => {
        if (role !== "host") return;
        const current = proposalRef.current;
        if (!current) return;
        const others = playersRef.current.filter((player) => player.id !== current.proposerId);
        const votesForProposal = votesRef.current.filter((vote) => vote.proposalId === current.id);
        const voters = new Set(votesForProposal.map((vote) => vote.voterId));
        if (others.length !== 0 && !others.every((player) => voters.has(player.id))) return;

        const outcome = decideResult(votesForProposal);
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
    }, [role, sendGameData]);

    useEffect(() => {
        decideVoteIfComplete();
    }, [players, decideVoteIfComplete]);

    useEffect(() => subscribe((message) => {
        if (message.type === "game-sync") {
            if (role !== "guest") return;
            const sync = message.sync;
            if (sync.game) {
                gameStateRef.current = sync.game;
                syncGameState(sync.game);
            }
            prepStepRef.current = sync.prep.step;
            setPrepStep(sync.prep.step);
            prepDoneRef.current = [...sync.prep.done];
            setPrepDone(prepDoneRef.current);
            prepCompleteRef.current = sync.prep.complete;
            setPrepComplete(sync.prep.complete);
            currentAttemptsRef.current = sync.currentAttempts;
            passedEncountersRef.current = sync.passedEncounters;
            setPassedEncounters(sync.passedEncounters);
            lastEncounterIndexRef.current = sync.lastEncounterIndex;

            const nextProposal = sync.proposal
                ? {
                    id: sync.proposal.proposalId,
                    proposerId: sync.proposal.proposerId,
                    card: sync.proposal.card,
                }
                : null;
            proposalRef.current = nextProposal;
            setProposal(nextProposal);
            const nextVotes = sync.votes.map((vote) => ({ ...vote }));
            votesRef.current = nextVotes;
            setVotes(nextVotes);
            const voted = !!nextProposal
                && nextVotes.some((vote) => vote.proposalId === nextProposal.id && vote.voterId === peerId);
            hasVotedRef.current = voted;
            setHasVoted(voted);

            const nextResult = sync.result
                ? {
                    id: sync.result.proposalId,
                    proposerId: sync.result.proposerId,
                    card: sync.result.card,
                    result: sync.result.result,
                    roll: sync.result.roll,
                }
                : null;
            setResultState(nextResult);
            pendingRollRef.current = null;
            resetRoll();
            return;
        }

        if (message.type !== "game-data" || !isGameDataPayload(message.payload)) return;
        const payload = message.payload;

        if (payload.kind === "prep-name-reset") {
            const next = prepDoneRef.current.filter((id) => id !== payload.playerId);
            prepDoneRef.current = next;
            setPrepDone(next);
            if (payload.playerId === peerId) setCharacterNameInput("");
            return;
        }

        if (payload.kind === "prep-done") {
            if (prepCompleteRef.current || payload.step !== prepStepRef.current) return;
            if (prepDoneRef.current.includes(payload.playerId)) return;
            const next = [...prepDoneRef.current, payload.playerId];
            prepDoneRef.current = next;
            setPrepDone(next);
            tryAdvancePrep();
            return;
        }

        if (payload.kind === "prep-advance") {
            prepStepRef.current = payload.step;
            prepDoneRef.current = [];
            setPrepStep(payload.step);
            setPrepDone([]);
            return;
        }

        if (payload.kind === "prep-complete") {
            prepCompleteRef.current = true;
            setPrepComplete(true);
            return;
        }

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
            setResultState(null);
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
            decideVoteIfComplete();
            return;
        }

        if (payload.kind === "vote-result") {
            clearProposal();
            resetRoll();
            setResultState({
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

            const attempt: ActionAttempt = {
                action: payload.card,
                gained: payload.gained,
                successes: payload.encounterSuccesses,
            };
            const attempts = [...currentAttemptsRef.current, attempt];
            currentAttemptsRef.current = attempts;

            const previousIndex = lastEncounterIndexRef.current;
            if (payload.gameOver || payload.currentEncounterIndex > previousIndex) {
                const encounter = currentGame?.encounters[previousIndex];
                if (encounter) {
                    const nextPassed = [...passedEncountersRef.current, { encounter, attempts }];
                    passedEncountersRef.current = nextPassed;
                    setPassedEncounters(nextPassed);
                }
                currentAttemptsRef.current = [];
            }
            lastEncounterIndexRef.current = payload.currentEncounterIndex;

            resetRoll();
            setResultState({
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
    }), [
        subscribe, role, peerId, sendGameData, applyGameProgress, syncGameState,
        playCard, tryAdvancePrep, decideVoteIfComplete,
    ]);

    const handlePrepDone = (characterName?: string) => {
        const id = peerId ?? "";
        if (!id || prepCompleteRef.current || prepDoneRef.current.includes(id)) return;
        if (characterName) submitCharacterName(characterName);
        sendGameData({ kind: "prep-done", playerId: id, step: prepStepRef.current });
    };

    const handleRemoveName = (playerId: string) => {
        clearCharacterName(playerId);
        if (playerId === peerId) setCharacterNameInput("");
    };

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

    const handleBackToLobby = () => {
        navigate("/lobby");
    };

    const hint = getHint(prepStep, prepComplete);

    if (!gameState) {
        return null;
    }

    if (!prepComplete) {
        return (
            <div className="game-layout">
                <ConnectionBanner />
                <aside className="player-sidebar">
                    <PlayerList players={players} peerId={peerId} hostId={hostId} />
                    {features.voiceChat && <AudioControls />}
                    {features.textChat && <ChatWindow />}
                </aside>
                <PrepPhase
                    quest={gameState.quest}
                    step={prepStep}
                    totalSteps={PREP_PROMPTS.length}
                    prompt={PREP_PROMPTS[prepStep]}
                    hand={gameState.hand}
                    donePlayers={prepDone}
                    players={players}
                    peerId={peerId}
                    onDone={handlePrepDone}
                    canRemoveNames={role === "host"}
                    onRemoveName={handleRemoveName}
                    characterName={characterNameInput}
                    onCharacterNameChange={setCharacterNameInput}
                />
                <QuestSidebar
                    quest={gameState.quest}
                    passedEncounters={passedEncounters}
                    totalEncounters={gameState.encounters.length}
                    hint={hint}
                />
            </div>
        );
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
            <ConnectionBanner />
            <aside className="player-sidebar">
                <PlayerList players={players} peerId={peerId} hostId={hostId} />
                {features.voiceChat && <AudioControls />}
                {features.textChat && <ChatWindow />}
            </aside>
            <main className="game-board">
                <EncounterCard encounter={encounter} successes={gameState.successes}></EncounterCard>
                <Hand cards={gameState.hand} onCardClick={handleCardClick}></Hand >
            </main>
            <QuestSidebar
                quest={gameState.quest}
                passedEncounters={passedEncounters}
                totalEncounters={gameState.encounters.length}
                hint={hint}
            />
            {result?.roll?.gameOver ? (
                <GameOverPopup
                    card={result.card}
                    result={result.result}
                    roll={result.roll}
                    onBackToLobby={handleBackToLobby}
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
                    onClose={() => setResultState(null)}
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
