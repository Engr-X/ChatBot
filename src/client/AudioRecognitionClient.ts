import { AudioTranscriber } from "../util/AudioTranscriber.js"
import { Message, TextData } from "../util/Conversation.js"
import type { AudioData, Conversation, Data } from "../util/Conversation.js"
import { AUDIO_UNRECOGNIZED_TEXT } from "../util/Misc.js"
import { Client } from "./Client.js"


const AUDIO_INPUT_PREFIX = "[User sent a voice message. Transcription]: "

type AudioRecognitionClientOptions = {
    conversation?: Conversation
    audioTranscriber?: AudioTranscriber
}


export class AudioRecognitionClient extends Client
{
    private readonly audioTranscriber: AudioTranscriber


    constructor(oppositeName: string, options: AudioRecognitionClientOptions = {})
    {
        super(oppositeName, "", options.conversation)
        this.audioTranscriber = options.audioTranscriber ?? new AudioTranscriber()
    }


    override async getReply(): Promise<Message | null>
    {
        const message = this.getLatestMessage()

        if (!message)
            return null

        const reply = new Message(message.role)

        for (const data of message.content)
            reply.addData(await this.convertData(data))

        return reply
    }


    private getLatestMessage()
    {
        const messages = this.getConversation().serialize().content
        return messages[messages.length - 1] ?? null
    }


    private async convertData(data: Data): Promise<Data>
    {
        switch (data.type)
        {
            case "input_audio":
                return this.convertAudioData(data)

            case "text":
            case "image_url":
            case "video_url":
            case "input_file":
                return data
        }
    }


    private async convertAudioData(data: AudioData): Promise<TextData>
    {
        const text = await this.audioTranscriber.transcribeSamples(
            data.input_audio.samples,
            data.input_audio.sampleRate,
        )

        const content = text.trim().length > 0 ? text.trim() : AUDIO_UNRECOGNIZED_TEXT
        return new TextData(AUDIO_INPUT_PREFIX + content)
    }
}
