import fallback from '../../assets/hero.png'; // Tell webpack this JS file uses this image
import { type Encounter } from '../../game/card-data';
import { SUCCESS_REQUIRED } from '../../game/rules';

type EncounterProps = {
    encounter: Encounter
    successes: number
    background?: string
}
function EncounterCard({ encounter, successes, background }: EncounterProps) {
    return (
        <div className='encounter'>
            <img src={background ?? fallback} />
            <h3>{encounter.title}</h3>
            {encounter.prompts.map((prompt) => (
                <p className='prompt' key={prompt}>{prompt}</p>
            ))}
            {encounter.flavor && <p className='flavor'>{encounter.flavor}</p>}
            <p className="successes" aria-label={`${successes} of 3 successes`}>
                {Array.from({length: SUCCESS_REQUIRED}).map((_, index) => (
                    <span key={index} className={index < successes ? "success" : undefined}>●</span>
                ))}
            </p>
        </div>
    )
}

export default EncounterCard;