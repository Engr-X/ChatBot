import { log } from "brolog"
import type { WechatyInterface } from "wechaty/impls"

import type { Data } from "../util/Conversation.js"
import { splitReplyMessages } from "../util/Misc.js"
import { IOStream } from "./IOStream.js"


const LOG_PREFIX = "WechatBot"

type ReadResolver = (data: Data | null) => void


export class WechatStream extends IOStream
{
    private readonly bot: WechatyInterface
    private readonly contactId: string
    private readonly queue: Data[]
    private readonly readers: ReadResolver[]
    private readonly replyPrefix: string
    private closed: boolean


    // constructor(bot: WechatyInterface, contactId: string, replyPrefix: string = "[AI 回复]: ")
    constructor(bot: WechatyInterface, contactId: string, replyPrefix: string = "")
    {
        super()
        this.bot = bot
        this.contactId = contactId
        this.queue = []
        this.readers = []
        this.replyPrefix = replyPrefix
        this.closed = false
    }


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
