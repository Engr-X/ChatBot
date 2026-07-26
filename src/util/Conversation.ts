import { ROLES } from "./Misc.js"


export type Role = typeof ROLES[number]


export class TextData
{
    readonly type = "text"
    readonly text: string


    constructor(text: string)
    {
        this.text = text
    }
}


export class ImageData
{
    readonly type = "image_url"

    readonly image_url:
    {
        url: string
    }


    constructor(url: string)
    {
        this.image_url = { url }
    }
}


export class VideoData
{
    readonly type = "video_url"

    readonly video_url:
    {
        url: string
    }


    constructor(url: string)
    {
        this.video_url = { url }
    }
}


export class AudioData
{
    readonly type = "input_audio"

    readonly input_audio:
    {
        samples: Float32Array
        sampleRate: number
        format: string
    }


    constructor(samples: Float32Array, sampleRate: number, format: string = "f32")
    {
        this.input_audio =
        {
            samples,
            sampleRate,
            format,
        }
    }
}


export class FileData
{
    readonly type = "input_file"
    readonly file_url: string


    constructor(fileUrl: string)
    {
        this.file_url = fileUrl
    }
}


export type Data = TextData | ImageData | VideoData | AudioData | FileData


export class Message
{
    private readonly role: Role
    private readonly content: Data[]


    constructor(role: Role)
    {
        this.role = role
        this.content = []
    }


    addData(data: Data): Message
    {
        this.content.push(data)
        return this
    }


    addDataToFront(data: Data): Message
    {
        this.content.unshift(data)
        return this
    }


    stringify(): string
    {
        return JSON.stringify(this.serialize())
    }


    serialize()
    {
        return { role: this.role, content: [...this.content] }
    }
}


export class Conversation
{
    private readonly name: string
    private readonly content: Message[]


    constructor(name: string)
    {
        this.name = name
        this.content = []
    }


    addMessage(message: Message): Conversation
    {
        this.content.push(message)
        return this
    }


    removeLastMessage(message: Message): boolean
    {
        const lastMessage: Message | undefined = this.content[this.content.length - 1]

        if (lastMessage !== message)
            return false

        this.content.pop()
        return true
    }


    stringify(): string
    {
        return JSON.stringify(this.serialize())
    }


    serialize()
    {
        return { content: this.content.map(message => message.serialize()) }
    }
}
