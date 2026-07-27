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

import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"
import { promisify } from "node:util"
import { readWaveFile } from "./AudioTranscriber.js"

import type { Message as WechatMessage } from "wechaty"
import type { Waveform } from "./AudioTranscriber.js"


/**
 * Promise-based version of Node.js {@link execFile}.
 *
 * It is used to invoke FFmpeg without passing the command through a shell.
 */
const execFileAsync = promisify(execFile)


/**
 * Role assigned to system instruction messages.
 */
export const ROLE_SYSTEM = "system"

/**
 * Role assigned to messages produced by the user.
 */
export const ROLE_USER = "user"

/**
 * Role assigned to messages produced by the assistant.
 */
export const ROLE_ASSISTANT = "assistant"

/**
 * Complete immutable list of conversation roles supported by this project.
 *
 * The {@code as const} assertion preserves each entry as a string literal,
 * allowing other types to derive a role union from this array.
 */
export const ROLES = [
    ROLE_SYSTEM,
    ROLE_USER,
    ROLE_ASSISTANT,
] as const


/**
 * Fallback text used when speech recognition produces no usable result.
 */
export const AUDIO_UNRECOGNIZED_TEXT = "[Unable to recognize audio]"


/**
 * Downloads a WeChat audio message, converts it to a normalized WAV file,
 * and reads the result into memory as waveform data.
 *
 * The conversion process performs the following steps:
 *  - Creates a unique temporary directory.
 *  - Downloads the WeChat attachment into that directory.
 *  - Converts the downloaded audio to mono 16 kHz WAV using FFmpeg.
 *  - Reads the WAV file into a {@link Waveform} object.
 *  - Removes the temporary directory and all generated files.
 *
 * The temporary directory is removed in a {@code finally} block, ensuring
 * cleanup occurs whether conversion succeeds or fails.
 *
 * @param message               the WeChat message containing the audio attachment to download and convert
 *
 * @return                      a promise resolving to the decoded floating-point waveform and its sample rate
 *
 * @throws                      if the attachment cannot be downloaded, FFmpeg conversion fails, the WAV
 *                              file cannot be read, or temporary-file operations fail
 */
export async function wechatAudioMessageToWaveform(message: WechatMessage): Promise<Waveform>
{
    const tempDir = await mkdtemp(join(tmpdir(), "wechat-audio-"))

    try
    {
        const fileBox = await message.toFileBox()
        const extension = extname(fileBox.name) || ".audio"
        const inputPath = join(tempDir, `input${extension}`)
        const wavPath = join(tempDir, "output.wav")

        await fileBox.toFile(inputPath, true)
        await convertAudioToWav(inputPath, wavPath)

        return readWaveFile(wavPath)
    }
    finally
    {
        await rm(tempDir, {
            force: true,
            recursive: true,
        })
    }
}


/**
 * Splits a generated reply into multiple message segments.
 *
 * A segment boundary is created when a sentence-ending punctuation character
 * is encountered outside a fenced Markdown code block.
 *
 * Supported separators are:
 *  - English period: {@code .}
 *  - Chinese full stop: {@code 。}
 *  - English question mark: {@code ?}
 *  - Chinese question mark: {@code ？}
 *  - English exclamation mark: {@code !}
 *  - Chinese exclamation mark: {@code ！}
 *
 * Triple-backtick code fences toggle code-block mode. Sentence punctuation
 * inside a code block does not split the reply.
 *
 * Empty and whitespace-only segments are discarded. Separator characters are
 * not included in the returned messages.
 *
 * @param reply                 the complete assistant reply to divide into separate outbound messages
 *
 * @return                      an ordered array containing the non-empty reply segments
 */
export function splitReplyMessages(reply: string): string[]
{
    const messages: string[] = []
    let currentMessage: string = ""
    let inCodeBlock: boolean = false
    const isReplySeparator = (char: string): boolean => {
        return char === "." || char === "\u3002" || char === "?" || char === "\uFF1F" || char === "!" || char === "\uFF01"
    }

    for (let index = 0; index < reply.length; index++)
    {
        if (reply.startsWith("```", index))
        {
            inCodeBlock = !inCodeBlock
            currentMessage += "```"
            index += 2
            continue
        }

        const char = reply[index]

        if (!inCodeBlock && char && isReplySeparator(char))
        {
            const message = currentMessage.trim()

            if (message.length > 0)
                messages.push(message)

            currentMessage = ""
            continue
        }

        currentMessage += char
    }

    const message = currentMessage.trim()

    if (message.length > 0)
        messages.push(message)

    return messages
}


/**
 * Converts an audio file into a mono 16 kHz WAV file using FFmpeg.
 *
 * FFmpeg is executed directly through {@link execFileAsync}, avoiding shell
 * interpolation of file paths and command arguments.
 *
 * The generated output uses:
 *  - One audio channel.
 *  - A sample rate of 16,000 Hz.
 *  - The WAV container format.
 *
 * Existing output files are overwritten.
 *
 * @param inputPath             path to the source audio file
 * @param wavPath               destination path for the converted WAV file
 *
 * @return                      a promise that resolves after FFmpeg completes successfully
 *
 * @throws Error                if FFmpeg is unavailable, the input cannot be decoded, the destination
 *                              cannot be written, or the conversion process exits unsuccessfully
 */
async function convertAudioToWav(inputPath: string, wavPath: string): Promise<void>
{
    try
    {
        await execFileAsync("ffmpeg", [
            "-y",
            "-i",
            inputPath,
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "wav",
            wavPath,
        ])
    }
    catch (error)
    {
        throw new Error(`Failed to convert WeChat audio to wav. Make sure ffmpeg is installed. ${error}`)
    }
}
