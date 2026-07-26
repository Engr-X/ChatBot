import type { Client } from "../client/Client.js"
import { Conversation, Message } from "../util/Conversation.js"
import type { IOStream } from "../stream/IOStream.js"
import { Agent } from "./Agent.js"


export class ChatAgent extends Agent
{
    private readonly audioClient: Client
    private readonly replyClient: Client
    private readonly conversation: Conversation


    constructor(
        name: string,
        stream: IOStream,
        replyClient: Client,
        audioClient: Client,
        timeIntervalSeconds: number,
    )
    {
        super(name, stream, [replyClient, audioClient], timeIntervalSeconds)

        if (audioClient.getConversation() !== replyClient.getConversation())
            throw new Error("ChatAgent clients must share one Conversation")

        this.replyClient = replyClient
        this.audioClient = audioClient
        this.conversation = replyClient.getConversation()
    }


    override async getResponse(message: Message): Promise<Message | null>
    {
        this.conversation.addMessage(message)

        let convertedMessage: Message | null = null

        try
        {
            convertedMessage = await this.audioClient.getReply()

            if (!convertedMessage)
            {
                this.conversation.removeLastMessage(message)
                return null
            }

            this.replaceLastMessage(message, convertedMessage)

            const reply: Message | null = await this.replyClient.getReply()

            if (!reply)
            {
                this.conversation.removeLastMessage(convertedMessage)
                return null
            }

            this.replyClient.addAssistantMessage(reply)
            return reply
        }
        catch (error)
        {
            if (convertedMessage)
                this.conversation.removeLastMessage(convertedMessage)
            else
                this.conversation.removeLastMessage(message)

            throw error
        }
    }


    private replaceLastMessage(oldMessage: Message, newMessage: Message): void
    {
        if (!this.conversation.removeLastMessage(oldMessage))
            throw new Error("Failed to replace latest message")

        this.conversation.addMessage(newMessage)
    }
}
