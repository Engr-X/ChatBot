import type { Client } from "../client/Client.js"
import { OllamaClient } from "../client/OllamaClient.js"
import type { Message } from "../util/Conversation.js"
import { STANDARD_STREAM } from "../stream/StandardStream.js"
import type { IOStream } from "../stream/IOStream.js"
import { Agent } from "./Agent.js"


export class SingleClientAgent extends Agent
{
    static readonly CONSOLE_AGENT = new SingleClientAgent(
        "Console",
        STANDARD_STREAM,
        new OllamaClient("Murphy"),
        5,
    )


    constructor(name: string, stream: IOStream, client: Client, timeIntervalSeconds: number)
    {
        super(name, stream, [client], timeIntervalSeconds)
    }


    override async getResponse(message: Message): Promise<Message | null>
    {
        const client: Client | undefined = this.clients[0]

        if (!client)
            return null

        client.addUserMessage(message)

        let reply: Message | null = null

        try
        {
            reply = await client.getReply()
        }
        catch (error)
        {
            client.removeLastMessage(message)
            throw error
        }

        if (!reply)
        {
            client.removeLastMessage(message)
            return null
        }

        client.addAssistantMessage(reply)
        return reply
    }
}
