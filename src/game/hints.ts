export type Hint = {
    title: string;
    paragraph: string;
};

const PREP_HINTS: Hint[] = [
    {
        title: "Define the quest",
        paragraph: "Decide, as a group, the details around your quest. The title and prompts are meant to inspire you, but the best adventures are the ones you create yourself.",
    },
    {
        title: "Describe your group",
        paragraph: "Talk about who you are together. What do you believe, how do you complement each other, and why does this quest matter to the group?",
    },
    {
        title: "Define your character",
        paragraph: "The cards in your hand hint at what you can do. Pick a name that fits your character, then tell the others when you are ready.",
    },
];

const ACTION_HINT: Hint = {
    title: "Play an action",
    paragraph: "Choose an action card from your hand. The others vote, then you roll the dice. Each 5 or 6 adds a success toward clearing the encounter.",
};

export function getHint(prepStep: number, prepComplete: boolean): Hint {
    if (prepComplete) return ACTION_HINT;
    return PREP_HINTS[prepStep] ?? PREP_HINTS[0];
}
