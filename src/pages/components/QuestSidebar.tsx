import type { Action, Encounter, MainQuest } from "../../game/card-data";
import type { Hint } from "../../game/hints";
import { SUCCESS_REQUIRED } from "../../game/rules";
import HintCard from "./Hint";

export type ActionAttempt = {
    action: Action;
    gained: number;
    successes: number;
};

export type PassedEncounter = {
    encounter: Encounter;
    attempts: ActionAttempt[];
};

type QuestSidebarProps = {
    quest: MainQuest;
    passedEncounters: PassedEncounter[];
    totalEncounters: number;
    hint: Hint;
};

function QuestSidebar({ quest, passedEncounters, totalEncounters, hint }: QuestSidebarProps) {
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
                <HintCard hint={hint} />
            </div>
        </aside>
    );
}

export default QuestSidebar;
