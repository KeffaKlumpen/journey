import fallback from '../../assets/hero.png'; // Tell webpack this JS file uses this image
import { type Encounter } from '../../game/card-data';

type EncounterProps = {
    encounter: Encounter
    questTitle: string
    successes: number
    background?: string
}
function EncounterCard({ encounter, questTitle, successes, background }: EncounterProps) {
    return (
        <div className='encounter'>
            <p className="quest-label">Quest: {questTitle}</p>
            <img src={background ?? fallback} />
            <h3>{encounter.title}</h3>
            {encounter.prompts.map((prompt) => (
                <p className='prompt' key={prompt}>{prompt}</p>
            ))}
            {encounter.flavor && <p className='flavor'>{encounter.flavor}</p>}
            <p className="successes" aria-label={`${successes} of 3 successes`}>
                {[0, 1, 2].map((index) => (
                    <span key={index} className={index < successes ? "success" : undefined}>●</span>
                ))}
            </p>
        </div>
    )
}

export default EncounterCard;