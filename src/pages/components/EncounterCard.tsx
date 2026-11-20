import fallback from '../../assets/hero.png'; // Tell webpack this JS file uses this image
import { type Encounter } from '../../game/card-data';

type EncounterProps = {
    encounter: Encounter
    background?: string
}
function EncounterCard({ encounter, background }: EncounterProps) {
    return (
        <div className='encounter'>
            <img src={background ?? fallback} />
            <h3>{encounter.title}</h3>
            {encounter.prompts.map((prompt) => (
                <p className='prompt' key={prompt}>{prompt}</p>
            ))}
            {encounter.flavor && <p className='flavor'>{encounter.flavor}</p>}
        </div>
    )
}

export default EncounterCard;