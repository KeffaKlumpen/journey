import { usePeer } from "../../net/peer-context";
import "./connection-banner.css";

function ConnectionBanner() {
    const { status, error, reconnect, retryNow, leaveLobby } = usePeer();

    if (status !== "reconnecting" && status !== "disconnected" && status !== "error") {
        return null;
    }

    const failed = status !== "reconnecting";

    return (
        <div
            className={`connection-banner ${failed ? "connection-banner-failed" : ""}`}
            role="status"
            aria-live="polite"
        >
            <span className="connection-banner-message">
                {status === "reconnecting"
                    ? `Connection lost — reconnecting${reconnect ? ` (attempt ${reconnect.attempt} of ${reconnect.maxAttempts})` : ""}…`
                    : (error || "Connection lost.")}
            </span>
            {failed && (
                <span className="connection-banner-actions">
                    <button onClick={retryNow}>Try again</button>
                    <button onClick={leaveLobby}>Leave lobby</button>
                </span>
            )}
        </div>
    );
}

export default ConnectionBanner;
