import { log } from "brolog"
import process from "node:process"
import { WechatyBuilder, qrcodeValueToImageUrl, types } from "wechaty"
import type { Message as WechatMessage } from "wechaty"
import type { WechatyInterface } from "wechaty/impls"

import { SingleClientAgent } from "./agent/SingleClientAgent.js"
import { ConversationManager } from "./ConversationManager.js"
import { TextData } from "./util/Conversation.js"
import type { Data } from "./util/Conversation.js"


const LOG_PREFIX: string = "WechatBot"
const REPLY_INTERVAL_SECONDS = 1


log.enableLogging((levelTitle: string, text?: string) => {
    const message = text ?? ""
    const match = /^(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+)\s*(.*)$/s.exec(message)

    if (!match)
    {
        process.stdout.write(`${message}\n`)
        return
    }

    const [, time, level, prefix, body] = match
    const formatted = `[${time} ${prefix}/${level}]: ${body}\n`

    if (levelTitle === "ERR")
        process.stderr.write(formatted)
    else
        process.stdout.write(formatted)
})


export const BOT: WechatyInterface = WechatyBuilder.build({ name: "wechat-bot" })

export const CONVERSATION_MANAGER: ConversationManager = new ConversationManager(
    (contactId, name) => SingleClientAgent.getWeichatBot(BOT, contactId, name),
    REPLY_INTERVAL_SECONDS,
)


function toData(message: WechatMessage): Data | null
{
    switch (message.type())
    {
        case types.Message.Text:
        {
            const text: string = message.text().trim()

            if (text.length === 0)
                return null

            return new TextData(text)
        }

        case types.Message.Audio:
        case types.Message.Image:
        case types.Message.Video:
        case types.Message.Attachment:
            return null

        default:
            return null
    }
}


async function handleMessage(message: WechatMessage): Promise<void>
{
    if (message.self())
        return

    if (message.room())
        return

    const talker = message.talker()

    if (talker.type() !== types.Contact.Individual)
        return

    const data: Data | null = toData(message)

    if (!data)
        return

    const talkerName: string = talker.name().trim() || talker.id

    switch (data.type)
    {
        case "text":
        {
            log.info(LOG_PREFIX, "Received from %s <%s>: %s", talkerName, talker.id, data.text)
            break
        }

        case "image_url":
        case "video_url":
        case "input_audio":
        case "input_file":
        {
            log.info(LOG_PREFIX, "Received from %s <%s>: %s", talkerName, talker.id, data.type)
            break
        }
    }

    CONVERSATION_MANAGER.receive(talker.id, data, talkerName)
}


BOT.on("scan", (qrcode, status) => {
        log.info(LOG_PREFIX, "Scan QR code to login. status=%s", status)
        log.info(LOG_PREFIX, qrcodeValueToImageUrl(qrcode))
    })
    .on("login", user => {
        log.info(LOG_PREFIX, "Login: %s", user.name())
    })
    .on("logout", user => {
        log.info(LOG_PREFIX, "Logout: %s", user.name())
    })
    .on("ready", () => {
        log.info(LOG_PREFIX, "Wechaty is ready")
    })
    .on("message", message => {
        void handleMessage(message).catch(error => {
            log.error(LOG_PREFIX, "Failed to handle message: %s", error)
        })
    })
    .on("error", error => {
        log.error(LOG_PREFIX, "Wechaty error: %s", error)
    })


async function main(): Promise<void>
{
    log.info(LOG_PREFIX, "Starting Wechaty...")
    await BOT.start()
    CONVERSATION_MANAGER.start()
    log.info(LOG_PREFIX, "Wechaty started")
}


void main().catch(error => {
    log.error(LOG_PREFIX, "Failed to start Wechaty: %s", error)
})
