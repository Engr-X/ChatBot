import { Conversation } from "../util/Conversation.js"
import type { Message } from "../util/Conversation.js"


export abstract class Client
{
    private readonly oppositeName: string
    private readonly conversation: Conversation


    constructor(oppositeName: string, conversation: Conversation = new Conversation(oppositeName))
    {
        this.oppositeName = oppositeName
        this.conversation = conversation
    }


    abstract getReply(): Promise<Message | null>


    protected getPrompt(): string
    {
        return `The person on the other side is named: ${this.oppositeName}. `
    }


    getConversation(): Conversation
    {
        return this.conversation
    }


    addSystemMessage(message: Message): Client
    {
        this.conversation.addMessage(message)
        return this
    }


    addUserMessage(message: Message): Client
    {
        this.conversation.addMessage(message)
        return this
    }


    addAssistantMessage(message: Message): Client
    {
        this.conversation.addMessage(message)
        return this
    }


    removeLastMessage(message: Message): boolean
    {
        return this.conversation.removeLastMessage(message)
    }
}
