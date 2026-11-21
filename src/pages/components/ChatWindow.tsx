import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePeer } from "../../net/peer-context";

function ChatWindow() {
    const { chatMessages, sendChat, players, peerId } = usePeer();
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [chatMessages]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!draft.trim()) return;
        sendChat(draft);
        setDraft("");
    };

    const displayName = (senderId: string) => {
        if (senderId === peerId) return "You";
        const player = players.find((candidate) => candidate.id === senderId);
        return player?.characterName ?? senderId.slice(0, 8);
    };

    return (
        <div className="chat-window">
            <h2>Chat</h2>
            <ul className="chat-messages" ref={listRef}>
                {chatMessages.length === 0 && <li className="chat-empty">No messages yet.</li>}
                {chatMessages.map((message) => (
                    <li key={message.id}>
                        <span className="chat-sender">{displayName(message.senderId)}</span>
                        <span className="chat-text">{message.text}</span>
                    </li>
                ))}
            </ul>
            <form className="chat-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Message"
                    maxLength={500}
                    aria-label="Chat message"
                />
                <button type="submit" disabled={!draft.trim()}>Send</button>
            </form>
        </div>
    );
}

export default ChatWindow;
