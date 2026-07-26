import process from "node:process"

import { SingleClientAgent } from "./agent/SingleClientAgent.js"
import { OllamaClient } from "./client/OllamaClient.js"
import { STANDARD_STREAM } from "./stream/StandardStream.js"


const CONSOLE_REPLY_INTERVAL_SECONDS = 5
const CONSOLE_SYSTEM_PROMPT = [
    "/no_think",
    "You are an auto-reply assistant for console chat testing.",
    "Reply in natural, sincere, concise Chinese.",
    "Reply like a real person casually chatting.",
    "Do not say that you are a large language model.",
    "Do not output thinking process.",
].join("\n")


async function main(): Promise<void>
{
    const agent = new SingleClientAgent(
        "Console",
        STANDARD_STREAM,
        new OllamaClient("Murphy", { prompt: CONSOLE_SYSTEM_PROMPT }),
        CONSOLE_REPLY_INTERVAL_SECONDS,
    )

    process.stdout.write(`Console agent started. Reply interval: ${CONSOLE_REPLY_INTERVAL_SECONDS}s. Press Ctrl+C to exit.\n`)
    agent.start()

    process.once("SIGINT", () => {
        agent.stop()
        void STANDARD_STREAM.close().finally(() => process.exit(0))
    })

    while (await agent.receive())
    {
    }

    agent.stop()
    await STANDARD_STREAM.close()
}


void main().catch(error => {
    process.stderr.write(`Console agent failed: ${String(error)}\n`)
    process.exitCode = 1
})
