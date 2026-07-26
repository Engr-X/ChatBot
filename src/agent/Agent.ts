import { Client } from "../client/Client.js"
import { Message } from "../util/Conversation.js"
import type { Data } from "../util/Conversation.js"
import { ROLE_USER } from "../util/Misc.js"
import type { IOStream } from "../stream/IOStream.js"


export abstract class Agent
{
    protected readonly name: string
    protected readonly stream: IOStream
    protected readonly clients: Client[]
    protected readonly timeIntervalSeconds: number
    protected currentMessage: Message
    private timer: ReturnType<typeof setInterval> | null
    private running: boolean


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


    addClient(client: Client): Agent
    {
        this.clients.push(client)
        return this
    }


    async receive(): Promise<boolean>
    {
        const data: Data | null = await this.stream.read()

        if (data === null)
            return false

        this.receiveData(data)
        return true
    }


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


    // with change in chat history (include the response)
    abstract getResponse(message: Message): Promise<Message | null>


    start(): void
    {
        if (this.timer)
            return

        this.timer = setInterval(() => {
            void this.runOnce()
        }, this.timeIntervalSeconds * 1000)
    }


    stop(): void
    {
        if (!this.timer)
            return

        clearInterval(this.timer)
        this.timer = null
    }


    isRunning(): boolean
    {
        return this.running
    }


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
        catch
        {
            if (!response)
                this.restoreMessage(message)

            return response !== null
        }
        finally
        {
            this.running = false
        }
    }


    private restoreMessage(message: Message): void
    {
        for (const data of [...message.serialize().content].reverse())
            this.currentMessage.addDataToFront(data)
    }


    private async writeMessage(message: Message): Promise<void>
    {
        for (const data of message.serialize().content)
            await this.stream.write(data)

        await this.stream.flush()
    }
}
