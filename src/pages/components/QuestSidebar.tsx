import { useState } from "react";
import type { Action, Encounter, MainQuest } from "../../game/card-data";
import { SUCCESS_REQUIRED } from "../../game/rules";
import HintCard, { type Hint } from "./Hint";

export type ActionAttempt = {
    action: Action;
    gained: number;
    successes: number;
};

export type PassedEncounter = {
    encounter: Encounter;
    attempts: ActionAttempt[];
};

const HINTS: Hint[] = [
    {
        title: "Define the quest",
        paragraph: "Decide, as a group, the details around your quest. The title and prompts are meant to inspire you, but the best adventures are the ones you create yourself.",
    },
];

type QuestSidebarProps = {
    quest: MainQuest;
    passedEncounters: PassedEncounter[];
    totalEncounters: number;
};

function QuestSidebar({ quest, passedEncounters, totalEncounters }: QuestSidebarProps) {
    const [hintIndex, setHintIndex] = useState(0);

    return (
        <aside className="quest-sidebar">
            <div className="quest-info">
                <h2>Main Quest</h2>
                <p className="quest-title">{quest.title}</p>
            </div>

            <div className="quest-progress">
                <h2>Passed encounters ({passedEncounters.length}/{totalEncounters})</h2>
                <ul>
                    {passedEncounters.map(({ encounter, attempts }, index) => (
                        <li key={`${encounter.title}-${index}`}>
                            <p className="passed-title">{encounter.title}</p>
                            <ul className="attempt-list">
                                {attempts.map((attempt, attemptIndex) => (
                                    <li key={attemptIndex}>
                                        {attempt.action} — +{attempt.gained} success
                                        {attempt.gained === 1 ? "" : "es"} ({attempt.successes}/{SUCCESS_REQUIRED})
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
                {passedEncounters.length === 0 && <p className="quest-empty">No encounters passed yet.</p>}
            </div>

            <div className="hint-list">
                <h2>Tutorial</h2>
                <HintCard hint={HINTS[hintIndex]} />
                {HINTS.length > 1 && (
                    <div className="hint-nav">
                        <button
                            type="button"
                            onClick={() => setHintIndex((index) => index - 1)}
                            disabled={hintIndex === 0}
                        >
                            Previous
                        </button>
                        <span>{hintIndex + 1}/{HINTS.length}</span>
                        <button
                            type="button"
                            onClick={() => setHintIndex((index) => index + 1)}
                            disabled={hintIndex === HINTS.length - 1}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}

export default QuestSidebar;
