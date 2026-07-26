import { Client } from "./Client.js"
import { Message, TextData } from "../util/Conversation.js"
import { ROLE_ASSISTANT } from "../util/Misc.js"


/**
 * Deterministic client used for local testing.
 *
 * Unlike model-backed clients, this implementation does not inspect the
 * conversation or call any external service. It always returns the same
 * assistant message, making it useful for testing:
 *
 * - Agent response handling
 * - Conversation updates
 * - Stream writing and flushing
 * - Multi-part message output
 * - Error-free client integration
 */
export class TestClient extends Client
{
    
    /**
     * Creates a deterministic test client.
     *
     * @param oppositeName      Human-readable name of the person on the other side of the conversation.
     *
     *                          The value is passed to the base {@link Client}, which creates a default
     *                          conversation and includes the name in its generated prompt context.
     *
     *                          Although this test client does not currently use the prompt or
     *                          conversation contents when generating its reply, it still initializes
     *                          the full base-client state so that it behaves like a normal client when
     *                          used by agents and tests.
     */
    constructor(oppositeName: string)
    {
        super(oppositeName)
    }


    /**
     * Produces a fixed assistant response for testing purposes.
     *
     * The returned message contains two separate {@link TextData} items:
     *
     * 1. `"Hello World"`
     * 2. `"第二"`
     *
     * Returning multiple data items allows tests to verify that callers write,
     * preserve, and process message content in the correct order.
     *
     * This method is asynchronous to match the {@link Client.getReply}
     * contract, even though it performs no asynchronous operation internally.
     *
     * @returns                 A promise resolving to an assistant-role {@link Message} containing two
     *                          fixed text data items.
     *
     *                          This implementation always returns a message and never returns `null`.
     */
    override async getReply(): Promise<Message | null>
    {
        return new Message(ROLE_ASSISTANT)
            .addData(new TextData("Hello World"))
            .addData(new TextData("第二"))
    }
}
