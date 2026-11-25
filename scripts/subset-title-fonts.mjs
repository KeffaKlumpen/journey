import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'src/assets/fonts/title');
const outputDir = path.join(root, 'src/assets/fonts/title-subset');
const licenceFile = path.join(root, 'public/title-font-licences.txt');

// One representative per folder. New folders fall back to the least variant-looking font.
const preferred = {
    bakso_sapi: 'BaksoSapi.otf',
    boston_traffic: 'boston.ttf',
    dream_orphans: 'Dream Orphans.otf',
    dune_rise: 'Dune_Rise.otf',
    edo_sz: 'edosz.ttf',
    help_me: 'HelpMe.ttf',
    huglove: 'Huglove.otf',
    hypik: 'hypik.otf',
    i_eat_crayons: 'i eat crayons.ttf',
    mostwasted: 'Mostwasted.ttf',
    oldnewspapertypes: 'OldNewspaperTypes.ttf',
    quicksand: 'Quicksand_Book.otf',
    verve: 'Verve.ttf',
};

const text = Array.from({ length: 0x7f - 0x20 + 1 }, (_, i) =>
    String.fromCharCode(0x20 + i),
).join('');

async function findFont(folder) {
    const folderDir = path.join(sourceDir, folder);

    if (preferred[folder]) {
        const candidate = path.join(folderDir, preferred[folder]);
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Fall through to discovery if a preferred file was renamed.
        }
    }

    async function walk(dir) {
        const entries = await readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) files.push(...(await walk(full)));
            else if (/\.(otf|ttf)$/i.test(entry.name)) files.push(full);
        }
        return files;
    }

    const candidates = await walk(folderDir);
    const variantPenalty = (file) => {
        const name = path.basename(file).toLowerCase();
        let score = name.endsWith('.ttf') ? 1 : 0;
        if (/italic|\bit\b|oblique/.test(name)) score += 10;
        if (/bold|\bbd\b/.test(name)) score += 8;
        if (/thin|light|wide|out|shad|shadow|cup|cud|3d|dash|alternate/.test(name)) score += 6;
        return score;
    };

    candidates.sort((a, b) => variantPenalty(a) - variantPenalty(b) || a.localeCompare(b));
    return candidates[0];
}

async function collectLicences(folders) {
    const sections = [];
    for (const folder of folders) {
        async function walk(dir) {
            const entries = await readdir(dir, { withFileTypes: true });
            const files = [];
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) files.push(...(await walk(full)));
                else if (/\.txt$/i.test(entry.name)) files.push(full);
            }
            return files;
        }

        const files = await walk(path.join(sourceDir, folder));
        for (const file of files) {
            sections.push(
                `===== ${path.relative(sourceDir, file)} =====\n${(await readFile(file, 'utf8')).trim()}\n`,
            );
        }
    }
    await writeFile(licenceFile, sections.join('\n'), 'utf8');
}

const folders = (await readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

await mkdir(outputDir, { recursive: true });
await collectLicences(folders);

for (const folder of folders) {
    const source = await findFont(folder);
    if (!source) {
        console.warn(`Skipping ${folder}: no .otf/.ttf found`);
        continue;
    }
    const target = path.join(outputDir, `${folder}.woff2`);
    const subset = await subsetFont(await readFile(source), text, {
        targetFormat: 'woff2',
        noHinting: true,
    });
    await writeFile(target, subset);
    console.log(
        `${folder}: ${path.relative(root, source)} -> ${path.relative(root, target)} (${subset.length} bytes)`,
    );
}
