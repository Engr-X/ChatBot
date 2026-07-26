import process from "node:process"

import { Conversation, Message, TextData } from "../util/Conversation.js"
import type { Data } from "../util/Conversation.js"
import { ROLE_ASSISTANT, ROLE_SYSTEM, ROLES } from "../util/Misc.js"
import { Client } from "./Client.js"


type OllamaClientOptions = {
    baseUrl?: string
    model?: string
    prompt?: string
    temperature?: number
}


const DEFAULT_BASE_URL = "http://127.0.0.1:11434"
const DEFAULT_MODEL = "qwen3.5:4b"


export class OllamaClient extends Client
{
    private readonly baseUrl: string
    private readonly model: string
    private readonly temperature: number | undefined

    
    constructor(oppositeName: string, options: OllamaClientOptions = {})
    {
        super(oppositeName, options.prompt)
        this.baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL
        this.model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
        this.temperature = options.temperature
    }


    override async getReply(): Promise<Message | null>
    {
        const messages = this.toOllamaMessages(this.getConversation())

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(this.createRequestBody(messages)),
        })

        if (!response.ok)
            return null

        const data = await response.json() as { message?: { content?: string } }
        const content = this.cleanReply(data.message?.content ?? "")

        if (content.length === 0)
            return null

        return new Message(ROLE_ASSISTANT).addData(new TextData(content))
    }


    private createRequestBody(messages: ReturnType<OllamaClient["toOllamaMessages"]>)
    {
        return {
            model: this.model,
            messages,
            stream: false,
            think: false,
            ...(this.temperature === undefined ? {} : { options: { temperature: this.temperature } }),
        }
    }


    private toOllamaMessages(conversation: Conversation)
    {
        const messages = [
            {
                role: ROLE_SYSTEM,
                content: this.getPrompt(),
            },
        ]

        for (const message of conversation.serialize().content)
        {
            const content: string = this.converter(message.content).trim()

            if (!this.isRole(message.role) || content.length === 0)
                continue

            messages.push({
                role: message.role,
                content,
            })
        }

        return messages
    }


    private converter(content: Data[]): string
    {
        const texts: string[] = []

        for (const data of content)
        {
            switch (data.type)
            {
                case "text":
                {
                    texts.push(data.text)
                    break
                }

                case "image_url":
                case "video_url":
                case "input_audio":
                case "input_file":
                    break
            }
        }

        return texts.join("\n")
    }


    private isRole(value: unknown): value is typeof ROLES[number]
    {
        return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    }


    private cleanReply(reply: string): string
    {
        return reply
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .trim()
    }
}
