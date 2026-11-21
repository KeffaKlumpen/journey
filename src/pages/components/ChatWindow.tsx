import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePeer } from "../../net/peer-context";

function ChatWindow() {
    const { chatMessages, sendChat, players, peerId } = usePeer();
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [chatMessages]);

    const sendDraft = () => {
        if (!draft.trim()) return;
        sendChat(draft.trim());
        setDraft("");
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        sendDraft();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendDraft();
        }
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
                <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.replace(/[\r\n]+/g, " "))}
                    onKeyDown={handleKeyDown}
                    placeholder="Message"
                    rows={2}
                    maxLength={200}
                    aria-label="Chat message"
                />
                <button type="submit" disabled={!draft.trim()}>Send</button>
            </form>
        </div>
    );
}

export default ChatWindow;
