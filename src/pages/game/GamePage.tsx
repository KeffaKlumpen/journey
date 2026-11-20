import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
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
import ResultPopup from "../components/ResultPopup";
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

type Result = {
    card: string;
    result: VoteOption;
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
    const { gameState, players, peerId, hostId, role, subscribe, sendGameData } = usePeer();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    const proposalRef = useRef<Proposal | null>(null);
    const votesRef = useRef<Vote[]>([]);
    const hasVotedRef = useRef(false);
    const playersRef = useRef<Player[]>(players);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

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

    useEffect(() => subscribe((message) => {
        if (message.type !== "game-data" || !isGameDataPayload(message.payload)) return;
        const payload = message.payload;

        if (payload.kind === "card-proposal") {
            if (proposalRef.current) return;
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
                clearProposal();
                sendGameData({
                    kind: "vote-result",
                    proposalId: current.id,
                    card: current.card,
                    result: outcome,
                });
            }
            return;
        }

        if (payload.kind === "vote-result") {
            clearProposal();
            setResult({ card: payload.card, result: payload.result });
        }
    }), [subscribe, role, sendGameData]);

    const handleCardClick = (card: string) => {
        if (proposalRef.current) return;
        const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        const proposerId = peerId ?? "";
        const next: Proposal = { id, proposerId, card };
        proposalRef.current = next;
        votesRef.current = [];
        hasVotedRef.current = false;
        setResult(null);
        setProposal(next);
        setVotes([]);
        setHasVoted(false);
        sendGameData({ kind: "card-proposal", proposalId: id, proposerId, card });
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
                <EncounterCard encounter={encounter}></EncounterCard>
                <Hand cards={gameState.hand} onCardClick={handleCardClick}></Hand >
            </main>
            {result ? (
                <ResultPopup card={result.card} result={result.result} onClose={() => setResult(null)} />
            ) : proposal && !hasVoted ? (
                <CardPopup
                    card={proposal.card}
                    isProposer={proposal.proposerId === peerId}
                    votesReceived={votesReceived}
                    totalVoters={otherPlayers.length}
                    onVote={handleVote}
                />
            ) : null}
        </div>
    )
}

export default GamePage;
