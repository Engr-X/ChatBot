/*
 * Copyright (c) 2026 Di Wang
 * SPDX-License-Identifier: MIT
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

import { ROLES } from "./Misc.js"


/**
 * Number of milliseconds between UTC and UTC+8.
 */
const UTC_8_OFFSET_MS = 8 * 60 * 60 * 1000


/**
 * Pads one date/time field to two digits.
 *
 * @param value             numeric date/time field
 *
 * @return                  two-digit string representation of the field
 */
function padDateField(value: number): string
{
    return value.toString().padStart(2, "0")
}


/**
 * Formats a date as a UTC+8 timestamp.
 *
 * The returned value is stable and independent from the machine's local time
 * zone. It uses the format {@code YYYY-MM-DD HH:mm:ss}.
 *
 * @param date              source date object
 *
 * @return                  formatted UTC+8 timestamp
 */
function formatUtc8Time(date: Date): string
{
    const utc8Date = new Date(date.getTime() + UTC_8_OFFSET_MS)
    const year = utc8Date.getUTCFullYear()
    const month = padDateField(utc8Date.getUTCMonth() + 1)
    const day = padDateField(utc8Date.getUTCDate())
    const hours = padDateField(utc8Date.getUTCHours())
    const minutes = padDateField(utc8Date.getUTCMinutes())
    const seconds = padDateField(utc8Date.getUTCSeconds())

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}


/**
 * Represents one supported conversation role.
 *
 * The type is derived directly from the values stored in {@link ROLES},
 * ensuring that role values remain synchronized with the project's role
 * constants.
 */
export type Role = typeof ROLES[number]


/**
 * Represents plain text content within a conversation message.
 */
export class TextData
{

    /**
     * Discriminator identifying this object as text data.
     */
    readonly type = "text"


    /**
     * Raw text content.
     */
    readonly text: string

    /**
     * Constructs a text data item.
     *
     * @param text              the raw text value stored in this data item
     */
    constructor(text: string)
    {
        this.text = text
    }
}


/**
 * Represents an image referenced by a URL.
 *
 * The object structure follows the project's multimodal message format.
 */
export class ImageData
{

    /**
     * Discriminator identifying this object as image URL data.
     */
    readonly type = "image_url"

    /**
     * Image reference object.
     */
    readonly image_url:
    {
        /**
         * URL identifying the image resource.
         */
        url: string
    }

    /**
     * Constructs an image data item.
     *
     * @param url               the URL of the image resource
     */
    constructor(url: string)
    {
        this.image_url = { url }
    }
}


/**
 * Represents a video referenced by a URL.
 */
export class VideoData
{   
    
    /**
     * Discriminator identifying this object as video URL data.
     */
    readonly type = "video_url"

    /**
     * Video reference object.
     */
    readonly video_url:
    {

        /**
         * URL identifying the video resource.
         */
        url: string
    }

    /**
     * Constructs a video data item.
     *
     * @param url               the URL of the video resource
     */
    constructor(url: string)
    {
        this.video_url = { url }
    }
}


/**
 * Represents in-memory audio samples supplied as message input.
 */
export class AudioData
{

    /**
     * Discriminator identifying this object as audio input data.
     */
    readonly type = "input_audio"

    /**
     * Audio waveform and format information.
     */
    readonly input_audio:
    {

        /**
         * Floating-point waveform samples.
         *
         * Values are typically normalized to the range
         * {@code [-1.0, 1.0]}.
         */
        samples: Float32Array

        /**
         * Number of samples per second, measured in hertz.
         *
         * For example, {@code 16000} represents 16 kHz audio.
         */
        sampleRate: number

        /**
         * String identifying the audio sample format.
         *
         * The default value {@code "f32"} indicates 32-bit floating-point
         * samples.
         */
        format: string
    }

    /**
     * Constructs an audio data item.
     *
     * @param samples           the floating-point waveform samples
     * @param sampleRate        the waveform sample rate, measured in hertz
     *
     * @param format            the audio sample format identifier; defaults to {@code "f32"}
     */
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


/**
 * Represents a file referenced by a URL or file identifier.
 */
export class FileData
{

    /**
     * Discriminator identifying this object as file input data.
     */
    readonly type = "input_file"

    /**
     * URL or location identifying the file resource.
     */
    readonly file_url: string


    /**
     * Constructs a file data item.
     *
     * @param fileUrl           the URL or location of the file resource
     */
    constructor(fileUrl: string)
    {
        this.file_url = fileUrl
    }
}


/**
 * Union of all data types that may be stored in a {@link Message}.
 *
 * The {@code type} property on each object acts as the discriminant used by
 * TypeScript to narrow the union.
 */
export type Data = TextData | ImageData | VideoData | AudioData | FileData


/**
 * Represents one role-based message in a conversation.
 *
 * A message contains:
 *
 * - One {@link Role} identifying the sender.
 * - An ordered collection of {@link Data} items.
 *
 * A single message may contain multiple content types, such as text followed
 * by an image or audio attachment.
 */
export class Message
{

    /**
     * Role associated with this message.
     */
    private readonly role: Role

    /**
     * Ordered data items contained in this message.
     */
    private readonly content: Data[]

    /**
     * Creation time of this message.
     *
     * The stored value is an absolute JavaScript {@link Date}. Use
     * {@link getTime} to read it as a UTC+8 display timestamp.
     */
    private readonly createdAt: Date


    /**
     * Constructs an empty message for the specified role.
     *
     * @param role              the system, user, or assistant role associated with this message
     *
     * @param createdAt         absolute creation time of the message; defaults to the current time
     */
    constructor(role: Role, createdAt: Date = new Date())
    {
        this.role = role
        this.content = []
        this.createdAt = new Date(createdAt.getTime())
    }


    /**
     * Appends one data item to the end of this message.
     *
     * @param data              the data item to append
     *
     * @return                  this message instance, allowing chained method calls
     *
     * @example
     * ```ts
     * const message = new Message("user")
     *     .addData(new TextData("Describe this image"))
     *     .addData(new ImageData("https://example.com/image.jpg"))
     * ```
     */
    addData(data: Data): Message
    {
        this.content.push(data)
        return this
    }


    /**
     * Inserts one data item at the beginning of this message.
     *
     * Existing data items are shifted toward the end of the content array.
     *
     * This method is useful when restoring data that must appear before items
     * received later.
     *
     * @param data              the data item to insert at the front of the message
     *
     * @return                  this message instance, allowing chained method calls
     */
    addDataToFront(data: Data): Message
    {
        this.content.unshift(data)
        return this
    }


    /**
     * Returns the message creation time as a UTC+8 timestamp.
     *
     * @return                  formatted UTC+8 time in {@code YYYY-MM-DD HH:mm:ss}
     */
    getTime(): string
    {
        return formatUtc8Time(this.createdAt)
    }


    /**
     * Returns a copy of the absolute creation time.
     *
     * @return                  copied {@link Date} object
     */
    getCreatedAt(): Date
    {
        return new Date(this.createdAt.getTime())
    }


    /**
     * Serializes this message into a JSON string.
     *
     * @return                  a JSON string containing the message role and content
     *
     * @throws TypeError        if one of the stored values cannot be serialized by
     *                          {@link JSON.stringify}
     */
    stringify(): string
    {
        return JSON.stringify(this.serialize())
    }


    /**
     * Converts this message into a plain serializable object.
     *
     * The returned content array is a shallow copy. Adding or removing items
     * from the returned array does not modify the message's internal array.
     *
     * However, individual {@link Data} objects inside the array are not deeply
     * copied and remain the same object references.
     *
     * @return                  an object containing the message role, UTC+8 time, and a shallow copy
     *                          of its content
     */
    serialize()
    {
        return { role: this.role, time: this.getTime(), content: [...this.content] }
    }
}


/**
 * Represents an ordered conversation history.
 *
 * A conversation stores {@link Message} objects in the order in which they
 * were added.
 *
 * The conversation name identifies the person or context associated with the
 * history, although it is not currently included in the serialized output.
 */
export class Conversation
{

    /**
     * Human-readable conversation name.
     *
     * This value commonly identifies the person on the other side of the
     * conversation.
     */
    private readonly name: string

    
    /**
     * Ordered list of messages stored in this conversation.
     */
    private readonly content: Message[]


    /**
     * Constructs an empty conversation.
     *
     * @param name              the human-readable name associated with this conversation
     */
    constructor(name: string)
    {
        this.name = name
        this.content = []
    }


    /**
     * Appends one message to the end of the conversation.
     *
     * The supplied message object is stored directly rather than copied.
     *
     * @param message           the message to append
     *
     * @return                  this conversation instance, allowing chained method calls
     *
     * @example
     * ```ts
     * conversation
     *     .addMessage(userMessage)
     *     .addMessage(assistantMessage)
     * ```
     */
    addMessage(message: Message): Conversation
    {
        this.content.push(message)
        return this
    }


    /**
     * Removes the latest conversation message when it is the expected object.
     *
     * The method uses object identity rather than comparing message contents.
     * The supplied object must therefore be the exact same {@link Message}
     * instance currently stored at the end of the conversation.
     *
     * @param message           the message expected to be the latest conversation entry
     *
     * @return                  {@code true} if the supplied message was the latest entry and was
     *                          removed, or {@code false} if the conversation is empty or another
     *                          message is currently last
     */
    removeLastMessage(message: Message): boolean
    {
        const lastMessage: Message | undefined = this.content[this.content.length - 1]

        if (lastMessage !== message)
            return false

        this.content.pop()
        return true
    }


    /**
     * Serializes this conversation into a JSON string.
     *
     * Each stored message is first converted through {@link Message.serialize}.
     *
     * @return                  a JSON string containing the serialized conversation messages
     *
     * @throws TypeError        if one of the stored message values cannot be serialized by
     *                          {@link JSON.stringify}
     */
    stringify(): string
    {
        return JSON.stringify(this.serialize())
    }


    /**
     * Converts this conversation into a plain serializable object.
     *
     * Each message is converted into a separate plain object through
     * {@link Message.serialize}. The returned array is independent from the
     * internal message array.
     *
     * The conversation name is currently not included in the serialized
     * representation.
     *
     * @return                  an object containing the serialized conversation message list
     */
    serialize()
    {
        return { content: this.content.map(message => message.serialize()) }
    }
}
