import { Agent } from "./Agent.js"
import { Conversation, Message } from "../util/Conversation.js"

import type { IOStream } from "../stream/IOStream.js"
import type { Client } from "../client/Client.js"


/**
 * Chat agent that processes user messages through two clients:
 *
 * 1. An audio preprocessing client that converts audio input into text.
 * 2. A reply client that generates the final assistant response.
 *
 * Both clients must share the same {@link Conversation} instance because the
 * preprocessing client modifies the latest user message before the reply
 * client reads the conversation.
 */
export class ChatAgent extends Agent
{
    
    /**
     * Client responsible for preprocessing audio input.
     *
     * It reads the latest user message from the shared conversation and
     * returns a converted message, usually replacing audio data with
     * transcribed text data.
     */
    private readonly audioClient: Client

    /**
     * Client responsible for generating the final assistant response.
     *
     * It reads the conversation after the latest user message has been
     * preprocessed by {@link audioClient}.
     */
    private readonly replyClient: Client

    /**
     * Conversation shared by both the audio and reply clients.
     *
     * The latest user message is temporarily inserted into this conversation,
     * optionally replaced with a preprocessed version, and then used to
     * generate the assistant reply.
     */
    private readonly conversation: Conversation


    /**
     * Creates a chat agent with an audio preprocessing stage followed by
     * a reply generation stage.
     *
     * Both clients must reference the exact same {@link Conversation} object.
     * Using separate conversation instances would cause the reply client to
     * miss the message produced by the audio preprocessing client.
     *
     * @param name              Human-readable name used to identify the agent.
     *
     * @param stream            Input/output stream used to receive user data and write generated
     *                          response data.
     *
     * @param replyClient       Client that generates the final assistant response after preprocessing
     *                          has completed.
     *
     * @param audioClient       Client that preprocesses the latest user message, typically by
     *                          converting audio data into text data.
     *
     * @param timeIntervalSeconds   Number of seconds between automatic response attempts performed by the
     *                              base {@link Agent} timer.
     */
    constructor(name: string, stream: IOStream,
        replyClient: Client, audioClient: Client, timeIntervalSeconds: number)
    {
        super(name, stream, [replyClient, audioClient], timeIntervalSeconds)

        if (audioClient.getConversation() !== replyClient.getConversation())
            throw new Error("ChatAgent clients must share one Conversation")

        this.replyClient = replyClient
        this.audioClient = audioClient
        this.conversation = replyClient.getConversation()
    }


    /**
     * Processes one completed user message and generates an assistant reply.
     *
     * Processing sequence:
     *
     * 1. Adds the original user message to the shared conversation.
     * 2. Calls the audio client to preprocess the latest message.
     * 3. Replaces the original message with the converted message.
     * 4. Calls the reply client to generate the final assistant response.
     * 5. Stores the generated assistant response in the conversation.
     *
     * When either client returns `null`, the temporary user message is removed
     * so that the conversation is restored to its previous state.
     *
     * @param message           Completed user message collected by the base {@link Agent}.
     *
     * The message may contain text, audio, images, files, or other supported
     * conversation data.
     *
     * @returns                 A promise resolving to:
     *                          - The generated assistant {@link Message} when both processing stages succeed.
     *                          - `null` when the audio client or reply client fails to produce a message.
     *
     * @throws                  Re-throws any error raised during preprocessing, message replacement,
     *                          reply generation, or conversation modification.
     *
     * Before re-throwing, the method attempts to remove the temporary user
     * message from the conversation.
     */
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


    /**
     * Replaces the latest conversation message with another message.
     *
     * The method first verifies that {@link oldMessage} is currently the last
     * message in the conversation. If the removal succeeds, the replacement
     * message is appended in its place.
     *
     * 
     * @param oldMessage        Message expected to be the current last conversation entry.
     *
     * @param newMessage        Message that should replace {@link oldMessage}.
     *
     * @throws
     * Throws an error when {@link oldMessage} is not the current last message
     * or cannot be removed from the conversation.
     */
    private replaceLastMessage(oldMessage: Message, newMessage: Message): void
    {
        if (!this.conversation.removeLastMessage(oldMessage))
            throw new Error("Failed to replace latest message")

        this.conversation.addMessage(newMessage)
    }
}
