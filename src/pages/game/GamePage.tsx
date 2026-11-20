import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { usePeer } from "../../net/peer-context";
import { isGameDataPayload, type Player, type VoteOption } from "../../net/messages";
import CardPopup from "../components/CardPopup";
import EncounterCard from "../components/EncounterCard";
import Hand from "../components/Hand";
import PlayerList from "../components/PlayerList";
import "./game.css";

type Proposal = {
    id: string;
    proposerId: string;
    card: string;
};

type Vote = {
    proposalId: string;
    voterId: string;
};

function GamePage() {
    const { gameState, players, peerId, hostId, subscribe, sendGameData } = usePeer();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [votes, setVotes] = useState<Vote[]>([]);

    const proposalRef = useRef<Proposal | null>(null);
    const votesRef = useRef<Vote[]>([]);
    const playersRef = useRef<Player[]>(players);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        if (!gameState) {
            navigate("/", { replace: true });
        }
    }, [gameState, navigate]);

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
            setProposal(next);
            setVotes([]);
            return;
        }

        if (payload.kind === "card-vote") {
            const alreadyVoted = votesRef.current.some((vote) =>
                vote.proposalId === payload.proposalId && vote.voterId === payload.voterId
            );
            const next = alreadyVoted
                ? votesRef.current
                : [...votesRef.current, { proposalId: payload.proposalId, voterId: payload.voterId }];
            votesRef.current = next;
            setVotes(next);

            const current = proposalRef.current;
            if (!current || current.id !== payload.proposalId) return;
            const others = playersRef.current.filter((player) => player.id !== current.proposerId);
            const voters = new Set(next
                .filter((vote) => vote.proposalId === current.id)
                .map((vote) => vote.voterId));
            if (others.length === 0 || others.every((player) => voters.has(player.id))) {
                proposalRef.current = null;
                votesRef.current = [];
                setProposal(null);
                setVotes([]);
            }
        }
    }), [subscribe]);

    const handleCardClick = (card: string) => {
        if (proposalRef.current) return;
        const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        const proposerId = peerId ?? "";
        const next: Proposal = { id, proposerId, card };
        proposalRef.current = next;
        votesRef.current = [];
        setProposal(next);
        setVotes([]);
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
        proposalRef.current = null;
        votesRef.current = [];
        setProposal(null);
        setVotes([]);
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
            {proposal && (
                <CardPopup
                    card={proposal.card}
                    isProposer={proposal.proposerId === peerId}
                    votesReceived={votesReceived}
                    totalVoters={otherPlayers.length}
                    onVote={handleVote}
                />
            )}
        </div>
    )
}

export default GamePage;
