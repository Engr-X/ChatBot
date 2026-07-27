/*
 * Copyright (c) 2026 Di Wang
 * SPDX-License-Identifier: MIT
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

import { Client } from "../client/Client.js"
import { Message } from "../util/Conversation.js"
import { ROLE_USER } from "../util/Misc.js"

import type { Data } from "../util/Conversation.js"
import type { IOStream } from "../stream/IOStream.js"


/**
 * Abstract base class for a timed agent.
 *
 * The agent accumulates incoming stream data into a single user message.
 * At a fixed interval, it asks the subclass to generate a response and then
 * writes the generated response back to the configured stream.
 *
 * Subclasses are responsible for implementing the actual response-generation
 * logic through {@link getResponse}.
 */
export abstract class Agent
{
    
    /**
     * Human-readable name of this agent.
     *
     * This value may be used by subclasses or callers for identification,
     * logging, debugging, or display purposes.
     */
    protected readonly name: string


    /**
     * Input/output stream used by this agent.
     *
     * Incoming data is read from this stream, and generated response data is
     * written back to the same stream.
     */
    protected readonly stream: IOStream


    /**
     * Ordered list of clients available to the agent.
     *
     * Subclasses may use these clients to transform messages, invoke models,
     * generate replies, or perform other processing steps.
     */
    protected readonly clients: Client[]


    /**
     * Number of seconds between automatic response attempts.
     *
     * The value is converted to milliseconds when the interval timer is
     * created in {@link start}.
     */
    protected readonly timeIntervalSeconds: number


    /**
     * User message currently being accumulated.
     *
     * Every accepted item received through {@link receive} or
     * {@link receiveData} is appended to this message.
     *
     * When a response cycle begins, this message is detached for processing
     * and replaced with a new empty user message so that new input can still
     * be collected while a response is being generated.
     */
    protected currentMessage: Message


    /**
     * Active interval timer.
     *
     * The value is `null` when the agent has not been started or has already
     * been stopped.
     */
    private timer: ReturnType<typeof setInterval> | null


    /**
     * Indicates whether a response cycle is currently running.
     *
     * This flag prevents multiple timer callbacks from generating responses
     * concurrently.
     */
    private running: boolean


    /**
     * Creates a new timed agent.
     *
     * @param name              Human-readable name used to identify the agent.
     *
     * @param stream            Input/output stream from which the agent reads incoming data and to
     *                          which it writes generated response data.
     *
     * @param clients           Initial ordered list of clients available to the agent. The array is
     *                          copied so that later modifications to the original array do not modify
     *                          the agent's internal client list.
     *
     * @param timeIntervalSeconds   Number of seconds between automatic calls to {@link runOnce}.
     */
    constructor(name: string, stream: IOStream, clients: Client[], timeIntervalSeconds: number)
    {
        this.name = name
        this.stream = stream
        this.clients = [...clients]
        this.timeIntervalSeconds = timeIntervalSeconds
        this.currentMessage = new Message(ROLE_USER)
        this.timer = null
        this.running = false
    }


     /**
     * Appends a client to the end of the agent's client pipeline.
     *
     * @param client            Client instance to add to the agent.
     *
     * @returns                 The current agent instance, allowing chained calls.
     *
     * @example
     * ```ts
     * agent
     *     .addClient(firstClient)
     *     .addClient(secondClient)
     * ```
     */
    addClient(client: Client): Agent
    {
        this.clients.push(client)
        return this
    }


    /**
     * Reads one data item from the configured stream and attempts to append it
     * to the current user message.
     *
     * @returns                 A promise that resolves to:
     *                          - `true` when the stream returned a non-null data item.
     *                          - `false` when the stream returned `null`.
     *
     * Note that the current implementation returns `true` whenever a non-null
     * item was read, even when {@link receiveData} rejects that item, such as
     * an empty text value.
     */
    async receive(): Promise<boolean>
    {
        const data: Data | null = await this.stream.read()

        if (data === null)
            return false

        this.receiveData(data)
        return true
    }


    /**
     * Validates and appends one typed data item to the current user message.
     *
     * Text items containing only whitespace are rejected. Supported non-text
     * items are appended without additional validation.
     *
     * @param data              Typed conversation data to append. Supported types are:
     *                          - `"text"`
     *                          - `"image_url"`
     *                          - `"video_url"`
     *                          - `"input_audio"`
     *                          - `"input_file"`
     *
     * @returns
     * `true` when the data item is accepted and appended.
     *
     * Returns `false` when:
     *
     * - The item is a text value containing only whitespace.
     * - The item has an unsupported data type.
     */
    receiveData(data: Data): boolean
    {
        switch (data.type)
        {
            case "text":
            {
                if (data.text.trim().length === 0)
                    return false

                this.currentMessage.addData(data)
                return true
            }

            case "image_url":
            case "video_url":
            case "input_audio":
            case "input_file":
                this.currentMessage.addData(data)
                return true

            default:
                return false
        }
    }


    /**
     * Generates a response for a completed user message.
     *
     * Subclasses must implement this method. A concrete implementation may,
     * for example, call one or more clients, update conversation history,
     * transform message data, or invoke an AI model.
     *
     * @param message           Completed user message captured for the current response cycle.
     *
     * This message is detached from {@link currentMessage}, so new incoming
     * data can continue to be collected while it is being processed.
     *
     * @returns                 A promise resolving to:
     *                          - A {@link Message} containing the generated response.
     *                          - `null` when no response could be generated.
     */
    abstract getResponse(message: Message): Promise<Message | null>


    /**
     * Starts the fixed-interval response timer.
     *
     * The timer calls {@link runOnce} every {@link timeIntervalSeconds} seconds.
     *
     * Calling this method while the agent is already started has no effect.
     */
    start(): void
    {
        if (this.timer)
            return

        this.timer = setInterval(() => {
            void this.runOnce()
        }, this.timeIntervalSeconds * 1000)
    }

   
    /**
     * Stops the fixed-interval response timer.
     *
     * Calling this method while the agent is already stopped has no effect.
     */
    stop(): void
    {
        if (!this.timer)
            return

        clearInterval(this.timer)
        this.timer = null
    }


    /**
     * Reports whether the agent is currently processing a response cycle.
     *
     * @returns                 `true` while {@link getResponse} or response writing is in progress;
     *                          otherwise `false`.
     */
    isRunning(): boolean
    {
        return this.running
    }


    /**
     * Immediately attempts to process the currently accumulated user message.
     *
     * The response cycle performs the following steps:
     *
     * 1. Rejects the call if another response cycle is already running.
     * 2. Checks whether the current message contains any data.
     * 3. Detaches the current message for processing.
     * 4. Creates a new empty message for newly arriving input.
     * 5. Calls {@link getResponse}.
     * 6. Writes the generated response to the output stream.
     * 7. Restores the original input when response generation fails.
     *
     * @returns                 A promise resolving to:
     *                          - `true` when there is no pending input.
     *                          - `true` when a response is generated and written successfully.
     *                          - `true` when a response was generated but an error occurred afterward,
     *                              such as during output writing.
     *                          - `false` when another response cycle is already running.
     *                          - `false` when no response is generated and the original message is
     *                              restored for a later retry.
     */
    async runOnce(): Promise<boolean>
    {
        if (this.running)
            return false

        const message = this.currentMessage

        const contentLength = message.serialize().content.length

        if (contentLength === 0)
            return true

        this.currentMessage = new Message(ROLE_USER)
        this.running = true
        let response: Message | null = null

        try
        {
            response = await this.getResponse(message)

            if (response)
            {
                await this.writeMessage(response)
                return true
            }

            this.restoreMessage(message)
            return false
        }
        catch (error)
        {
            if (!response)
            {
                this.restoreMessage(message)
                throw error
            }

            return response !== null
        }
        finally
        {
            this.running = false
        }
    }


    /**
     * Restores a failed message to the front of the pending input buffer.
     *
     * The restored data is inserted before any new input that arrived while
     * the failed message was being processed.
     *
     * @param message           Original user message that could not be processed successfully.
     */
    private restoreMessage(message: Message): void
    {
        for (const data of [...message.serialize().content].reverse())
            this.currentMessage.addDataToFront(data)
    }


    /**
     * Writes every data item in a response message to the output stream.
     *
     * Items are written sequentially to preserve their original order. After
     * all items have been written, the stream is flushed so that any buffered
     * output is committed.
     *
     * @param message           Response message whose content should be written to the stream.
     *
     * @returns                 A promise that resolves after every data item has been written and the
     *                          stream has been flushed.
     */
    private async writeMessage(message: Message): Promise<void>
    {
        for (const data of message.serialize().content)
            await this.stream.write(data)

        await this.stream.flush()
    }
}
