import type { WechatyInterface } from "wechaty/impls"

import type { Client } from "../client/Client.js"
import { OllamaClient } from "../client/OllamaClient.js"
import type { Message } from "../util/Conversation.js"
import { STANDARD_STREAM } from "../stream/StandardStream.js"
import { WechatStream } from "../stream/WechatStream.js"
import type { IOStream } from "../stream/IOStream.js"
import { Agent } from "./Agent.js"


export class SingleClientAgent extends Agent
{
    static readonly CONSOLE_AGENT = new SingleClientAgent(
        "Murphy",
        STANDARD_STREAM,
        new OllamaClient("Murphy"),
        10,
    )


    static getWeichatBot(bot: WechatyInterface, contactId: string, oppositeName: string = contactId): SingleClientAgent
    {
        return new SingleClientAgent(
            contactId,
            new WechatStream(bot, contactId),
            new OllamaClient(oppositeName),
            10,
        )
    }


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
