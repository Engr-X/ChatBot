import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"
import { promisify } from "node:util"
import type { Message as WechatMessage } from "wechaty"

import { readWaveFile } from "./AudioTranscriber.js"
import type { Waveform } from "./AudioTranscriber.js"


const execFileAsync = promisify(execFile)

export const ROLE_SYSTEM = "system"
export const ROLE_USER = "user"
export const ROLE_ASSISTANT = "assistant"
export const ROLES = [ROLE_SYSTEM, ROLE_USER, ROLE_ASSISTANT] as const

export const INPUT_TEXT = "text"
export const INPUT_IMAGE = "image"
export const INPUT_AUDIO = "audio"


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
