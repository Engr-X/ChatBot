import { Client } from "./Client.js"
import { Message, TextData } from "../util/Conversation.js"
import { ROLE_ASSISTANT } from "../util/Misc.js"


export class TestClient extends Client
{
    constructor(oppositeName: string)
    {
        super(oppositeName)
    }


    override async getReply(): Promise<Message | null>
    {
        return new Message(ROLE_ASSISTANT)
            .addData(new TextData("Hello World"))
            .addData(new TextData("第二"))
    }
}
