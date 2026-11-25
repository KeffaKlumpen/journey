import { useEffect, useState } from 'react';

const fonts = Object.entries(
    import.meta.glob<string>('../../assets/fonts/title-subset/*.woff2', {
        eager: true,
        query: '?url',
        import: 'default',
    }),
).map(([path, url]) => ({
    url,
    // Neutral names avoid the reserved-name clauses in some of the source licences.
    family: `journey-title-${path.split('/').pop()!.replace(/\.woff2$/, '')}`,
}));

const readyFamilies = new Set<string>();

type TitleFontState = {
    fontFamily: string;
    ready: boolean;
};

const fallbackState: TitleFontState = { fontFamily: 'var(--heading)', ready: true };

export function useRandomTitleFont(): TitleFontState {
    const [font] = useState(() => fonts[Math.floor(Math.random() * fonts.length)]);
    const [state, setState] = useState<TitleFontState>(() => {
        if (!font) return fallbackState;
        if (readyFamilies.has(font.family)) {
            return { fontFamily: `"${font.family}", var(--heading)`, ready: true };
        }
        return { fontFamily: 'var(--heading)', ready: false };
    });

    useEffect(() => {
        if (!font || readyFamilies.has(font.family)) return;

        let active = true;
        const face = new FontFace(font.family, `url("${font.url}")`, { display: 'swap' });

        face.load()
            .then((loaded) => {
                if (!active) return;
                document.fonts.add(loaded);
                readyFamilies.add(font.family);
                setState({ fontFamily: `"${font.family}", var(--heading)`, ready: true });
            })
            .catch(() => {
                if (active) setState(fallbackState);
            });

        return () => {
            active = false;
        };
    }, [font]);

    return state;
}
