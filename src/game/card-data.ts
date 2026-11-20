export type MainQuest = {
    title: string,
    prompts: [string, string, string, string?]
}
export const mainQuests : MainQuest[] = [
    {
        title: "The Impostor",
        prompts: ["Who is the importer posing as?", "Do you know their true identity?", "Where is the true person?", "Why do you need to unmask the imposter?"]
    },
    {
        title: "Escort your Highness",
        prompts: ["Who is your highness?", "Where are they going?", "Do they want to go?", "Why do they need an escort?"]
    },
    {
        title: "Restore your honor",
        prompts: ["How did you lose your honor?", "Who is responsible?", "To whom are you dishonored?", "Why do you need to restore it?"]
    },
    {
        title: "Break the curse",
        prompts: ["Who/what is cursed?", "What does the curse do?", "Where did the curse come from?", "Why do you need to break the curse?"]
    },
    {
        title: "Deliver the antidote",
        prompts: ["Who/what is poisoned?", "Who has the antidote?", "What caused the poisoning?"]
    },
    {
        title: "Treasure hunt",
        prompts: ["What are you looking for?", "Why are you looking for it?", "What makes this treasure unique?", "What happens if you can't find it?"]
    },
]

export type Action = string
export const actions : Action[] = [
    "Lick",
    "Kick",
    "Run",
    "Flirt",
    "Touch",
    "Wave",
    "Doubt",
    "Search",
]

export type Encounter = {
    title: string,
    prompts: [string, string, string, string?]
    flavor?: string
}

export const encounters: Encounter[] = [
    {
        title: "An old acquaintance...",
        prompts: ["How do you know them?", "Are they happy to see you?", "Are you happy to see them?", "Why is this a problem?"],
    },
    {
        title: "Broken bridge",
        prompts: ["What kind of bridge was it?", "What's on the other side?", "Did it break recently?", "Why do you need to cross?"],
    },
    {
        title: "It's a trap!",
        prompts: ["How are you trapped?", "Is everyone trapped?", "Who made the trap?", "What happens if you don't escape?"],
    },
    {
        title: "Fell down a well",
        prompts: ["Who/what?", "How/why?", "What's down there?"],
        flavor: "Well well well..."
    },
    {
        title: "Is that… a DRAGON!?",
        prompts: ["What kind of dragon is it?", "What is it doing?", "Does it say anything?", "How does it stop you?"],
    },
    {
        title: "I forgot the [...]!",
        prompts: ["What did you forget?", "Why did you forget it?", "Do you know where it is?", "Why do you need it?"],
        flavor: "Doh!"
    }
]