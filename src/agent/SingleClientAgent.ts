import { OllamaClient } from "../client/OllamaClient.js"
import { STANDARD_STREAM } from "../stream/StandardStream.js"
import { Agent } from "./Agent.js"

import type { Message } from "../util/Conversation.js"
import type { IOStream } from "../stream/IOStream.js"
import type { Client } from "../client/Client.js"


/**
 * Agent implementation that processes each completed user message through
 * exactly one client.
 *
 * The agent stores the user message in the client's conversation, requests
 * a reply from the client, stores the successful assistant reply, and returns
 * it to the base {@link Agent} for stream output.
 */
export class SingleClientAgent extends Agent
{
    /**
     * Preconfigured console agent intended for local development and manual
     * testing.
     *
     * This instance:
     *
     * - Uses {@link STANDARD_STREAM} for console input and output.
     * - Uses a local {@link OllamaClient} named `"Murphy"`.
     * - Attempts to process pending input every five seconds.
     *
     * Because this field is initialized when the module is loaded, the
     * contained client and agent instance are created immediately when this
     * module is imported.
     */
    static readonly CONSOLE_AGENT = new SingleClientAgent(
        "Console",
        STANDARD_STREAM,
        new OllamaClient("Murphy"),
        5,
    )


    /**
     * Creates an agent that delegates response generation to one client.
     *
     * @param name              Human-readable name used to identify the agent.
     *                          This value may be used for logging, debugging, status output, or display
     *                          purposes by the base class or other callers.
     *
     * @param stream            Input/output stream used by the agent.
     *                          The agent reads incoming user data from this stream and writes generated
     *                          assistant response data back to it.
     *
     * @param client            Client responsible for maintaining conversation history and generating
     *                          assistant replies.
     *                          The client is stored as the only entry in the inherited
     *                          {@link Agent.clients} array.
     *
     * @param timeIntervalSeconds   Number of seconds between automatic response attempts.
     *
     * The base {@link Agent} converts this value to milliseconds when creating
     * its interval timer.
     */
    constructor(name: string, stream: IOStream, client: Client, timeIntervalSeconds: number)
    {
        super(name, stream, [client], timeIntervalSeconds)
    }


     /**
     * Generates an assistant response using the configured client.
     *
     * Processing sequence:
     *
     * 1. Retrieves the first and only client from the inherited client list.
     * 2. Adds the completed user message to the client's conversation.
     * 3. Requests an assistant reply from the client.
     * 4. Removes the user message if reply generation fails.
     * 5. Stores a successful assistant reply in the conversation.
     * 6. Returns the reply to the base agent for stream output.
     *
     * @param message           Completed user message collected by the base {@link Agent}.
     *                          The message may contain text, images, audio, files, or any other data
     *                          type supported by the client implementation.
     *
     * @returns                 A promise resolving to:
     *                          - The generated assistant {@link Message} when the client successfully produces a reply.
     *                          - `null` when no client is configured.
     *                          - `null` when the client does not produce a reply.
     *
     * @throws                  Re-throws any error raised by {@link Client.getReply}.
     *                          Before re-throwing, the method removes the user message that was added
     *                          for the failed request so that the conversation does not retain an
     *                          incomplete interaction.
     */
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
