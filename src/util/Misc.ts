export const ROLE_SYSTEM = "system"
export const ROLE_USER = "user"
export const ROLE_ASSISTANT = "assistant"
export const ROLES = [ROLE_SYSTEM, ROLE_USER, ROLE_ASSISTANT] as const

export const INPUT_TEXT = "text"
export const INPUT_IMAGE = "image"
export const INPUT_AUDIO = "audio"


export function splitReplyMessages(reply: string): string[]
{
    const messages: string[] = []
    let currentMessage: string = ""
    let inCodeBlock: boolean = false

    for (let index = 0; index < reply.length; index++)
    {
        if (reply.startsWith("```", index))
        {
            inCodeBlock = !inCodeBlock
            currentMessage += "```"
            index += 2
            continue
        }

        const char = reply[index]

        if (!inCodeBlock && char && isReplySeparator(char))
        {
            const message = currentMessage.trim()

            if (message.length > 0)
                messages.push(message)

            currentMessage = ""
            continue
        }

        currentMessage += char
    }

    const message = currentMessage.trim()

    if (message.length > 0)
        messages.push(message)

    return messages
}


function isReplySeparator(char: string): boolean
{
    return char === "." || char === "\u3002" || char === "?" || char === "\uFF1F"
}
