import type { Data } from "../util/Conversation.js"


/**
 * Minimal asynchronous input/output abstraction used by agents.
 *
 * IOStream defines the communication boundary between an {@link Agent} and
 * an external data source or destination.
 *
 * Implementations may represent different transport mechanisms, such as:
 *
 * - Console input/output
 * - Network connections
 * - WebSocket communication
 * - File streams
 * - Message queues
 * - Other asynchronous data channels
 *
 * The stream transfers individual {@link Data} items rather than complete
 * messages, allowing agents to incrementally build and process multimodal
 * conversations.
 */
export abstract class IOStream
{
    
    /**
     * Reads one data item from the input side of the stream.
     *
     * Implementations should resolve with one available {@link Data} item when
     * input is received.
     *
     * Returning `null` indicates that the stream has been closed or that no
     * further data can be read.
     *
     * @returns
     * A promise resolving to:
     *
     * - A {@link Data} item when input is successfully received.
     * - `null` when the stream is closed or unavailable.
     *
     * @throws
     * May reject when the underlying input source encounters an error.
     */
    abstract read(): Promise<Data | null>


    /**
     * Writes one data item to the output side of the stream.
     *
     * Implementations should send or store the provided data item. The method
     * does not require the implementation to immediately commit buffered data;
     * callers may invoke {@link flush} afterward when needed.
     *
     * @param output
     * Data item that should be written to the stream.
     *
     * The item may represent text, images, audio, files, video, or any other
     * supported conversation data type.
     *
     * @returns
     * A promise that resolves when the data item has been accepted by the
     * stream implementation.
     *
     * @throws
     * May reject when the output destination cannot accept the data.
     */
    abstract write(output: Data): Promise<void>


    /**
     * Flushes buffered output data.
     *
     * Some stream implementations may buffer writes for performance reasons.
     * Calling flush ensures that pending output is delivered or committed.
     *
     * The default implementation performs no operation because not every
     * stream requires explicit flushing.
     *
     * Subclasses may override this method when their transport needs manual
     * synchronization.
     *
     * @returns
     * A promise that resolves when buffered output has been flushed.
     *
     * @throws
     * May reject when flushing fails.
     */
    async flush(): Promise<void> {}

    
    /**
     * Closes the stream and releases associated resources.
     *
     * Implementations may use this method to:
     *
     * - Close network connections
     * - Release file handles
     * - Stop background readers
     * - Notify waiting consumers
     *
     * The default implementation performs no operation.
     *
     * @returns
     * A promise that resolves after the stream has been closed.
     *
     * @throws
     * May reject when the underlying resource cannot be released cleanly.
     */
    async close(): Promise<void> {}
}
