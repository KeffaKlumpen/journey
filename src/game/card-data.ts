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