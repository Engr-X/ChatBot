import type { Agent } from "./agent/Agent.js"
import type { Data } from "./util/Conversation.js"


const DEFAULT_TIME_INTERVAL_SECONDS = 10

type AgentFactory = (conversationId: string, name: string) => Agent


export class ConversationManager
{
    private readonly agents: Map<string, [Agent, boolean]>
    private readonly agentFactory: AgentFactory
    private readonly timeIntervalSeconds: number
    private timer: ReturnType<typeof setInterval> | null


    constructor(agentFactory: AgentFactory, timeIntervalSeconds: number = DEFAULT_TIME_INTERVAL_SECONDS)
    {
        this.agents = new Map<string, [Agent, boolean]>()
        this.agentFactory = agentFactory
        this.timeIntervalSeconds = timeIntervalSeconds
        this.timer = null
    }


    receive(conversationId: string, data: Data, name: string = conversationId): boolean
    {
        const pair = this.getOrCreateAgent(conversationId, name)
        const agent = pair[0]
        let received = false

        switch (data.type)
        {
            case "text":
            {
                received = agent.receiveData(data)
                break
            }

            case "image_url":
            case "video_url":
            case "input_audio":
            case "input_file":
            default:
                break
        }

        if (received)
            pair[1] = true

        return received
    }


    getOrCreateAgent(conversationId: string, name: string = conversationId): [Agent, boolean]
    {
        const pair: [Agent, boolean] | undefined = this.agents.get(conversationId)

        if (pair)
            return pair

        const newAgent = this.agentFactory(conversationId, name)
        const newPair: [Agent, boolean] = [newAgent, false]
        this.agents.set(conversationId, newPair)
        return newPair
    }


    start(): void
    {
        if (this.timer)
            return

        this.timer = setInterval(() => {
            void this.runOnce()
        }, this.timeIntervalSeconds * 1000)
    }


    stop(): void
    {
        if (!this.timer)
            return

        clearInterval(this.timer)
        this.timer = null
    }


    async runOnce(): Promise<void>
    {
        const tasks: Promise<void>[] = []

        for (const [conversationId, pair] of this.agents)
        {
            const agent = pair[0]
            const pending = pair[1]

            if (!pending)
                continue

            if (agent.isRunning())
                continue

            pair[1] = false
            tasks.push(this.runAgent(pair))
        }

        await Promise.all(tasks)
    }
    

    async replyAll(): Promise<void>
    {
        await this.runOnce()
    }


    private async runAgent(pair: [Agent, boolean]): Promise<void>
    {
        const agent = pair[0]

        try
        {
            const success = await agent.runOnce()

            if (!success)
                pair[1] = true
        }
        catch
        {
            pair[1] = true
        }
    }
}
