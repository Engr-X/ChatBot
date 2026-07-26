import type { Client } from "../client/Client.js"
import { AudioTranscriber } from "../util/AudioTranscriber.js"
import { Message, TextData } from "../util/Conversation.js"
import type { Data } from "../util/Conversation.js"
import type { IOStream } from "../stream/IOStream.js"
import { SingleClientAgent } from "./SingleClientAgent.js"


const VOICE_TRANSCRIPTION_PREFIX = "[Voice transcription] "


export class ChatAgent extends SingleClientAgent
{
    private readonly audioTranscriber: AudioTranscriber


    constructor(
        name: string,
        stream: IOStream,
        client: Client,
        timeIntervalSeconds: number,
        audioTranscriber: AudioTranscriber = new AudioTranscriber(),
    )
    {
        super(name, stream, client, timeIntervalSeconds)
        this.audioTranscriber = audioTranscriber
    }


    override async getResponse(message: Message): Promise<Message | null>
    {
        return super.getResponse(await this.prepareMessage(message))
    }


    private async prepareMessage(message: Message): Promise<Message>
    {
        const serialized = message.serialize()
        const preparedMessage = new Message(serialized.role)

        for (const data of serialized.content)
            await this.addPreparedData(preparedMessage, data)

        return preparedMessage
    }


    private async addPreparedData(message: Message, data: Data): Promise<void>
    {
        switch (data.type)
        {
            case "text":
            case "image_url":
            case "video_url":
            case "input_file":
            {
                message.addData(data)
                break
            }

            case "input_audio":
            {
                const text = await this.audioTranscriber.transcribeSamples(
                    data.input_audio.samples,
                    data.input_audio.sampleRate,
                )

                if (text.trim().length > 0)
                    message.addData(new TextData(VOICE_TRANSCRIPTION_PREFIX + text.trim()))

                break
            }
        }
    }
}
