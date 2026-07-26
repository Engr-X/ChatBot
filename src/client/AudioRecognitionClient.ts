import { AudioTranscriber } from "../util/AudioTranscriber.js"
import { Message, TextData } from "../util/Conversation.js"
import { AUDIO_UNRECOGNIZED_TEXT } from "../util/Misc.js"
import { Client } from "./Client.js"

import type { AudioData, Conversation, Data } from "../util/Conversation.js"


/**
 * Prefix inserted before text produced from a voice message.
 *
 * The prefix informs later model clients that the following text was generated
 * by speech recognition rather than typed directly by the user.
 */
const AUDIO_INPUT_PREFIX = "[User sent a voice message. Transcription]: "


/**
 * Configuration options for {@link AudioRecognitionClient}.
 */
type AudioRecognitionClientOptions = {
    /**
     * Conversation used by the audio recognition client.
     *
     * Supplying an existing conversation allows this client to share message
     * history with another client, such as a language-model reply client.
     *
     * When omitted, the base {@link Client} creates a new conversation using
     * the supplied opposite participant name.
     */
    conversation?: Conversation

    /**
     * Speech recognition implementation used to convert audio samples into
     * text.
     *
     * Supplying this option allows callers to reuse an existing transcriber,
     * provide a custom implementation, or inject a test double.
     *
     * When omitted, a new {@link AudioTranscriber} instance is created.
     */
    audioTranscriber?: AudioTranscriber
}


/**
 * Client that preprocesses the latest conversation message by converting
 * audio data into text data.
 *
 * The client creates and returns a transformed copy of the latest message:
 *
 * - Audio items are transcribed and replaced with {@link TextData}.
 * - Text, image, video, and file items are preserved unchanged.
 * - The original message stored in the conversation is not modified directly.
 *
 * The caller is responsible for replacing or otherwise handling the original
 * message after this client returns the transformed copy.
 */
export class AudioRecognitionClient extends Client
{
    /**
     * Speech-to-text component used to transcribe audio sample data.
     */
    private readonly audioTranscriber: AudioTranscriber


    /**
     * Creates an audio preprocessing client.
     *
     * @param oppositeName      Human-readable name of the person on the other side of the conversation.
     *                          This value is passed to the base {@link Client}. It is also used when a
     *                          new default conversation must be created.
     *
     * @param options           Optional configuration for conversation sharing and speech recognition.
     *
     * @param options.conversation  Existing conversation to read from.
     *                              This should usually be the same conversation used by the client that
     *                              generates the final assistant response.
     *
     * @param options.audioTranscriber  Speech recognizer used to convert raw audio samples into text.
     *                                  A new {@link AudioTranscriber} is created when this option is omitted.
     */
    constructor(oppositeName: string, options: AudioRecognitionClientOptions = {})
    {
        super(oppositeName, "", options.conversation)
        this.audioTranscriber = options.audioTranscriber ?? new AudioTranscriber()
    }


    /**
     * Creates a transformed copy of the latest conversation message.
     *
     * Every data item is processed in its original order. Audio items are
     * asynchronously transcribed into text, while all other supported items
     * are copied into the new message unchanged.
     *
     * The role of the original message is preserved.
     *
     * @returns                 A promise resolving to:
     *                          - A new {@link Message} containing the transformed data.
     *                          - `null` when the conversation does not contain any messages.
     *
     * @throws                  Rejects when audio transcription fails or when another asynchronous
     *                          conversion operation throws an error.
     */
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


    /**
     * Returns the latest serialized message in the conversation.
     *
     * This method reads the serialized conversation representation rather than
     * returning the original mutable {@link Message} instance.
     *
     * @returns                 The final serialized message when the conversation contains at least one
     *                          message; otherwise `null`.
     */
    private getLatestMessage()
    {
        const messages = this.getConversation().serialize().content
        return messages[messages.length - 1] ?? null
    }


    /**
     * Converts one conversation data item.
     *
     * Audio data is transcribed into text. Every other supported data type is
     * returned unchanged.
     *
     * @param data              Conversation data item to transform.
     *                          Supported variants are:
     *                          - `"input_audio"`
     *                          - `"text"`
     *                          - `"image_url"`
     *                          - `"video_url"`
     *                          - `"input_file"`
     *
     * @returns                 A promise resolving to:
     *                          - A {@link TextData} item when the input contains audio.
     *                          - The original data object for all non-audio input types.
     *
     * @throws                  Rejects when transcription of an audio item fails.
     */
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


    /**
     * Transcribes one audio data item and wraps the result as text data.
     *
     * Raw samples and their sample rate are passed to
     * {@link AudioTranscriber.transcribeSamples}. Leading and trailing
     * whitespace is removed from the transcription.
     *
     * When the recognizer returns an empty or whitespace-only result,
     * {@link AUDIO_UNRECOGNIZED_TEXT} is used instead.
     *
     * @param data              Audio data containing raw samples and the sample rate required to
     *                          interpret those samples.
     *
     * @param data.input_audio.samples      Sequence of raw audio sample values to transcribe.
     *
     * @param data.input_audio.sampleRate   Number of audio samples per second, measured in hertz.
     *
     * @return                  A promise resolving to a {@link TextData} item containing:
     *                          1. {@link AUDIO_INPUT_PREFIX}
     *                          2. The trimmed transcription, or {@link AUDIO_UNRECOGNIZED_TEXT} when no
     *                          speech could be recognized.
     *
     * @throws                  Rejects when the speech recognizer cannot process the supplied audio.
     */
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
