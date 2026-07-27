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

import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline"
import { TextData } from "../util/Conversation.js"
import { IOStream } from "./IOStream.js"

import type { Interface } from "node:readline"
import type { Readable, Writable } from "node:stream"
import type { Data } from "../util/Conversation.js"


/**
 * Console-backed {@link IOStream} implementation.
 *
 * StandardStream reads complete text lines from a Node.js readable stream and
 * writes conversation data to a Node.js writable stream.
 *
 * Text data is written directly. Non-text data is represented using readable
 * placeholder strings because a plain terminal cannot directly render the
 * project's media and file data types.
 *
 * By default, the stream uses the current process's standard input and
 * standard output.
 */
export class StandardStream extends IOStream
{
    
    /**
     * Readable source used for console input.
     *
     * This is normally {@link stdin}, but another readable stream may be
     * injected for testing or custom terminal integration.
     */
    private readonly input: Readable


    /**
     * Writable destination used for console output.
     *
     * This is normally {@link stdout}, but another writable stream may be
     * supplied for testing, output capture, or redirection.
     */
    private readonly output: Writable


    /**
     * Node.js readline interface used to divide the input stream into complete
     * lines.
     *
     * The interface remains active until {@link close} is called or the input
     * stream reaches its end.
     */
    private readonly reader: Interface


    /**
     * Asynchronous iterator produced by the readline interface.
     *
     * Each call to `next()` waits for and returns one complete input line.
     */
    private readonly iterator: AsyncIterator<string>


    /**
     * Creates a console-backed input/output stream.
     *
     * @param input             Node.js readable stream from which complete input lines are consumed.
     *                          Defaults to the current process's {@link stdin}.
     *
     *                          A custom stream may be supplied when testing input behavior or reading
     *                          from another line-oriented source.
     *
     * @param output            Node.js writable stream to which formatted output is written.
     *                          Defaults to the current process's {@link stdout}.
     *
     *                          A custom stream may be supplied for testing, logging, redirection, or
     *                          output capture.
     */
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


     /**
     * Reads one complete line from the input stream.
     *
     * The line is wrapped in a {@link TextData} object so it can be processed
     * through the same conversation-data interface as other input types.
     *
     * The newline delimiter itself is not included in the returned text.
     *
     * @returns
     * A promise resolving to:
     *
     * - A {@link TextData} item containing the next input line.
     * - `null` when the readline iterator has completed because the input was
     *   closed or reached the end of the stream.
     *
     * @throws
     * Rejects when the underlying readline iterator or readable stream reports
     * an input error.
     */
    override async read(): Promise<Data | null>
    {
        const result = await this.iterator.next()

        if (result.done)
            return null

        return new TextData(result.value)
    }


    /**
     * Writes one conversation data item to the output stream.
     *
     * Text items are written directly. Media and file items are converted into
     * readable placeholder strings because standard terminal output cannot
     * render them directly.
     *
     * This method does not append a newline. The caller should invoke
     * {@link flush} after writing a complete response.
     *
     * @param output            Conversation data item to display.
     *                          Supported variants are:
     *                          - `"text"`: writes the text directly.
     *                          - `"image_url"`: writes an image URL placeholder.
     *                          - `"video_url"`: writes a video URL placeholder.
     *                          - `"input_audio"`: writes an audio-format placeholder.
     *                          - `"input_file"`: writes a file URL placeholder.
     *
     * @returns                 A promise that resolves after the formatted output has been accepted by
     *                          the underlying writable stream.
     *
     * @throws                  Rejects when writing to the underlying output stream fails.
     */
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


    /**
     * Writes raw text to the configured output stream.
     *
     * The callback-based Node.js `Writable.write` API is wrapped in a promise
     * so callers can use `await` and receive write errors through normal promise
     * rejection.
     *
     * @param output                Raw string to write to the underlying output stream.
     *                              No newline or additional formatting is added by this method.
     *
     * @returns                     A promise that resolves when the write callback reports completion.
     *
     * @throws                      Rejects when the writable stream passes an error to the write callback.
     */
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


    /**
     * Finishes the current console output line.
     *
     * This implementation treats flushing as writing one newline character.
     * It does not call an operating-system-level flush operation because normal
     * Node.js writable streams do not expose a general asynchronous flush API.
     *
     * @returns                 A promise that resolves after the newline has been written.
     *
     * @throws                  Rejects when the underlying output stream cannot write the newline.
     */
    override async flush(): Promise<void>
    {
        await this.writeText("\n")
    }


    /**
     * Closes the readline interface.
     *
     * Closing the interface stops line consumption and releases listeners
     * installed by Node.js readline.
     *
     * This method does not explicitly destroy the injected input or output
     * streams because they may be shared resources such as process stdin and
     * stdout.
     *
     * @returns                 A promise that resolves immediately after the readline interface has
     *                          been closed.
     */
    override async close(): Promise<void>
    {
        this.reader.close()
    }
}


/**
 * Shared console stream instance used by console-based agents.
 *
 * The instance reads from the current process's standard input and writes to
 * its standard output.
 *
 * Because this object is created when the module is evaluated, importing this
 * module also creates its readline interface immediately.
 */
export const STANDARD_STREAM = new StandardStream()
