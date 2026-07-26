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
    private closed: boolean


    constructor(bot: WechatyInterface, contactId: string)
    {
        super()
        this.bot = bot
        this.contactId = contactId
        this.queue = []
        this.readers = []
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

        const messages = this.formatOutput(output)

        for (const message of messages)
        {
            await contact.say(message)
            log.info(LOG_PREFIX, "Sent to %s <%s>: %s", contact.name(), contact.id, message)
        }
    }


    private formatOutput(output: Data): string[]
    {
        switch (output.type)
        {
            case "text":
                return splitReplyMessages(output.text)

            case "image_url":
                return [`[image: ${output.image_url.url}]`]

            case "video_url":
                return [`[video: ${output.video_url.url}]`]

            case "input_audio":
                return [`[audio: ${output.input_audio.format}]`]

            case "input_file":
                return [`[file: ${output.file_url}]`]
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
