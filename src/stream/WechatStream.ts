import { log } from "brolog"
import type { WechatyInterface } from "wechaty/impls"

import type { Data } from "../util/Conversation.js"
import { splitReplyMessages } from "../util/Misc.js"
import { IOStream } from "./IOStream.js"


/**
 * Logger category used when recording outbound WeChat messages.
 */
const LOG_PREFIX = "WechatBot"

/**
 * Callback used to complete a pending asynchronous read operation.
 *
 * The callback receives a {@link Data} item when new input arrives, or
 * {@code null} when the stream is closed.
 *
 * @param data the received data item, or {@code null} if the stream is closed
 */
type ReadResolver = (data: Data | null) => void


/**
 * An asynchronous input/output stream bound to a single WeChat contact.
 *
 * Incoming data is supplied through {@link push} and consumed through
 * {@link read}. Outgoing text data is sent to the configured WeChat contact
 * through the provided Wechaty bot instance.
 *
 * The stream maintains:
 *
 * A queue of unread inbound data.
 * A queue of pending readers waiting for future input.
 *
 * When data is pushed while a reader is waiting, the data is delivered
 * directly to the oldest pending reader. Otherwise, the data is added to the
 * internal queue.
 *
 * This implementation currently supports text output only. Other output data
 * types are ignored.
 */
export class WechatStream extends IOStream
{
    /**
     * Wechaty bot instance used to locate contacts and send messages.
     */
    private readonly bot: WechatyInterface

    /**
     * Unique WeChat contact identifier associated with this stream.
     */
    private readonly contactId: string

    /**
     * Queue containing inbound data items that have not yet been consumed.
     */
    private readonly queue: Data[]

    /**
     * Queue containing pending read callbacks waiting for future input.
     */
    private readonly readers: ReadResolver[]

    /**
     * Text prefix prepended to every outgoing reply segment.
     */
    private readonly replyPrefix: string

    /**
     * Indicates whether this stream has been closed.
     */
    private closed: boolean


    /**
     * Constructs a WeChat stream for one contact.
     *
     * @param bot               the Wechaty bot instance used to locate the contact and send messages
     * @param contactId         the unique WeChat identifier of the contact associated with this stream
     * @param replyPrefix       the prefix prepended to every outgoing text reply; defaults to
     *                          {@code "[AI 自动回复]: "}
     */
    constructor(bot: WechatyInterface, contactId: string, replyPrefix: string = "[AI 自动回复]: ")
    // constructor(bot: WechatyInterface, contactId: string, replyPrefix: string = "")
    {
        super()
        this.bot = bot
        this.contactId = contactId
        this.queue = []
        this.readers = []
        this.replyPrefix = replyPrefix
        this.closed = false
    }


    /**
     * Adds one inbound data item to this stream.
     *
     * If a read operation is currently waiting for data, the item is delivered
     * directly to the oldest pending reader. Otherwise, the item is appended to
     * the internal input queue.
     *
     * Data cannot be added after the stream has been closed.
     *
     * @param data              the inbound conversation data item to add
     *
     * @return                  {@code true} if the data was accepted, or {@code false} if the stream
     *                          has already been closed
     */
    push(data: Data): boolean
    {
        if (this.closed)
            return false

        const reader: ReadResolver | undefined = this.readers.shift()

        if (reader)
        {
            reader(data)
            return true
        }

        this.queue.push(data)
        return true
    }


    /**
     * Reads one inbound data item from this stream.
     *
     * If queued data is available, the oldest item is returned immediately.
     * If the queue is empty and the stream is still open, the returned promise
     * remains pending until {@link push} supplies new data.
     *
     * If the stream is closed and no queued data remains, this method returns
     * {@code null}.
     *
     * @return                  a promise resolving to the next available {@link Data} item, or
     *                          {@code null} when the stream has been closed
     */
    override async read(): Promise<Data | null>
    {
        const data: Data | undefined = this.queue.shift()

        if (data)
            return data

        if (this.closed)
            return null

        return new Promise(resolve => {
            this.readers.push(resolve)
        })
    }


    /**
     * Writes one conversation data item to the configured WeChat contact.
     *
     * Text output is divided into one or more reply segments using
     * {@link splitReplyMessages}. Each segment is prefixed with
     * {@link replyPrefix} and sent separately.
     *
     * Image, video, audio, and file outputs are currently ignored.
     *
     * @param output            the conversation data item to send
     *
     * @return                  a promise that resolves after all supported output has been sent
     *
     * @throws Error            if the contact associated with {@link contactId} cannot be found
     * @throws                  if Wechaty fails to locate the contact or send a message
     */
    override async write(output: Data): Promise<void>
    {
        const contact = await this.bot.Contact.find({ id: this.contactId })

        if (!contact)
            throw new Error(`Contact not found: ${this.contactId}`)

        switch (output.type)
        {
            case "text":
            {
                const messages = splitReplyMessages(output.text)

                for (const message of messages)
                {
                    await contact.say(this.replyPrefix + message)
                    log.info(LOG_PREFIX, "Sent to %s <%s>: %s", contact.name(), contact.id, message)
                }

                break
            }

            case "image_url":
            case "video_url":
            case "input_audio":
            case "input_file":
                break
        }
    }


    /**
     * Closes this stream and releases all pending read operations.
     *
     * Closing the stream performs the following operations:
     *
     * Marks the stream as closed.
     * Discards all queued unread data.
     * Resolves every pending reader with {@code null}.
     * Clears the pending-reader queue.
     *
     * Calling this method more than once has no effect.
     *
     * @return                  a promise that resolves after the stream has been closed
     */
    override async close(): Promise<void>
    {
        if (this.closed)
            return

        this.closed = true
        this.queue.length = 0

        for (const reader of this.readers)
            reader(null)

        this.readers.length = 0
    }
}
