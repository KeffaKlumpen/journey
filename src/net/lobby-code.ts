// Excludes ambiguous characters (0/O and 1/I/L), so codes are easy to read and repeat.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 6;
const SHORT_CODE_PATTERN = /^[A-Z0-9]{6}$/i;

export function generateLobbyCode(): string {
    // ALPHABET.length is a power of two, so a simple modulo stays unbiased.
    const values = new Uint32Array(CODE_LENGTH);
    crypto.getRandomValues(values);
    return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join("");
}

export function normalizeLobbyCode(raw: string): string {
    const trimmed = raw.trim();
    // Only reshape values that look like a short code; leave legacy peer IDs untouched.
    return SHORT_CODE_PATTERN.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}
