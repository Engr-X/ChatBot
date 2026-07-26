import type { Data } from "../util/Conversation.js"


export abstract class IOStream
{
    abstract read(): Promise<Data | null>

    abstract write(output: Data): Promise<void>

    async flush(): Promise<void> {}

    async close(): Promise<void> {}
}
