import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline"
import type { Interface } from "node:readline"
import type { Readable, Writable } from "node:stream"

import { TextData } from "../util/Conversation.js"
import type { Data } from "../util/Conversation.js"
import { IOStream } from "./IOStream.js"


export class StandardStream extends IOStream
{
    private readonly input: Readable
    private readonly output: Writable
    private readonly reader: Interface
    private readonly iterator: AsyncIterator<string>


    constructor(input: Readable = stdin, output: Writable = stdout)
    {
        super()
        this.input = input
        this.output = output
        this.reader = createInterface({
            input: this.input,
            output: this.output,
        })
        this.iterator = this.reader[Symbol.asyncIterator]()
    }


    override async read(): Promise<Data | null>
    {
        const result = await this.iterator.next()

        if (result.done)
            return null

        return new TextData(result.value)
    }


    override async write(output: Data): Promise<void>
    {
        switch (output.type)
        {
            case "text":
            {
                await this.writeText(output.text)
                break
            }

            case "image_url":
            {
                await this.writeText(`[image: ${output.image_url.url}]`)
                break
            }

            case "video_url":
            {
                await this.writeText(`[video: ${output.video_url.url}]`)
                break
            }

            case "input_audio":
            {
                await this.writeText(`[audio: ${output.input_audio.format}]`)
                break
            }

            case "input_file":
            {
                await this.writeText(`[file: ${output.file_url}]`)
                break
            }
        }
    }


    private async writeText(output: string): Promise<void>
    {
        await new Promise<void>((resolve, reject) => {
            this.output.write(output, error => {
                if (error)
                {
                    reject(error)
                    return
                }

                resolve()
            })
        })
    }


    override async flush(): Promise<void>
    {
        await this.writeText("\n")
    }


    override async close(): Promise<void>
    {
        this.reader.close()
    }
}


export const STANDARD_STREAM = new StandardStream()
