import { usePeer } from "../../net/peer-context";

function AudioControls() {
    const { isMuted, toggleMute, voiceError } = usePeer();

    return (
        <div className="audio-controls">
            <button type="button" onClick={toggleMute}>
                {isMuted ? "Unmute" : "Mute"}
            </button>
            {voiceError && <p className="audio-error">{voiceError}</p>}
        </div>
    );
}

export default AudioControls;
