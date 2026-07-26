import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import process from "node:process"


/**
 * Represents decoded single-channel audio waveform data.
 */
export type Waveform = {

    /**
     * Normalized floating-point audio samples.
     *
     * Sample values are typically expected to be within the range
     * {@code [-1.0, 1.0]}.
     */
    samples: Float32Array

    /**
     * Number of audio samples per second, measured in hertz.
     *
     * For example, {@code 16000} represents 16 kHz audio.
     */
    sampleRate: number
}


/**
 * Minimal recognition result returned by the Sherpa-ONNX offline recognizer.
 */
type OfflineRecognizerResult = {

    /**
     * Recognized text.
     *
     * This property may be absent when the recognizer produces no result.
     */
    text?: string
}


/**
 * Recognition stream used to receive audio samples before decoding.
 */
type OfflineStream = {

    /**
     * Supplies one waveform to this recognition stream.
     *
     * @param waveform          the waveform samples and sample rate to process
     */
    acceptWaveform(waveform: Waveform): void
}


/**
 * Minimal interface for a Sherpa-ONNX offline speech recognizer.
 */
type OfflineRecognizer = {

    /**
     * Creates a new independent decoding stream.
     *
     * Each transcription operation should use a new stream so recognition
     * state is not shared between unrelated audio inputs.
     *
     * @return                  a new offline recognition stream
     */
    createStream(): OfflineStream


    /**
     * Asynchronously decodes the audio previously supplied to a stream.
     *
     * @param stream            the recognition stream containing the waveform to decode
     *
     * @return                  a promise resolving to the recognition result
     *
     * @throws                  if decoding fails
     */
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>
}


/**
 * Configuration accepted by the Sherpa-ONNX offline recognizer.
 */
type OfflineRecognizerConfig = {

    /**
     * Audio feature extraction configuration.
     */
    featConfig: {

        /**
         * Sample rate expected by the recognition model, measured in hertz.
         */
        sampleRate: number

        /**
         * Number of feature dimensions produced for each audio frame.
         */
        featureDim: number
    }

    /**
     * Recognition model and runtime configuration.
     */
    modelConfig: {

        /**
         * SenseVoice model-specific configuration.
         */
        senseVoice: {

            /**
             * Absolute path to the SenseVoice ONNX model file.
             */
            model: string

            /**
             * Recognition language or automatic language selection mode.
             */
            language: string

            /**
             * Integer flag controlling inverse text normalization.
             *
             * A value of {@code 1} enables normalization and {@code 0}
             * disables it.
             */
            useInverseTextNormalization: number
        }

        /**
         * Absolute path to the token vocabulary file.
         */
        tokens: string

        /**
         * Number of CPU threads used during inference.
         */
        numThreads: number

        /**
         * Integer flag controlling Sherpa-ONNX debug output.
         */
        debug: number

        /**
         * Runtime execution provider, such as {@code "cpu"}.
         */
        provider: string
    }
}


/**
 * Minimal subset of the {@code sherpa-onnx-node} module used by this file.
 */
type SherpaOnnx = {
    /**
     * Factory for creating offline recognizer instances.
     */
    OfflineRecognizer: {
        /**
         * Asynchronously creates an offline recognizer.
         *
         * @param config        recognizer model, feature, and runtime configuration
         *
         * @return              a promise resolving to an initialized recognizer
         *
         * @throws              if the model cannot be loaded or the configuration is invalid
         */
        createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>
    }

    /**
     * Reads and decodes a WAV file.
     *
     * @param filePath          absolute or resolved path to the WAV file
     *
     * @return                  decoded waveform samples and their sample rate
     *
     * @throws                  if the file cannot be opened or decoded
     */
    readWave(filePath: string): Waveform
}


/**
 * Configuration options for {@link AudioTranscriber}.
 */
export type AudioTranscriberOptions = {

    /**
     * Directory containing the model and token files.
     *
     * The directory is used only when {@link modelPath} or
     * {@link tokensPath} are not supplied.
     *
     * Defaults to {@code models/sherpa-onnx} under the current working
     * directory.
     */
    modelDir?: string

    /**
     * Path to the SenseVoice ONNX model file.
     *
     * Relative paths are resolved against the current working directory.
     * When omitted, {@code model.int8.onnx} under {@link modelDir} is used.
     */
    modelPath?: string

    /**
     * Path to the SenseVoice token vocabulary file.
     *
     * Relative paths are resolved against the current working directory.
     * When omitted, {@code tokens.txt} under {@link modelDir} is used.
     */
    tokensPath?: string

    /**
     * Language setting passed to the SenseVoice model.
     *
     * Defaults to {@code "auto"}, allowing the model to detect the language
     * automatically.
     */
    language?: string

    /**
     * Number of threads used for model inference.
     *
     * Defaults to {@code 2}.
     */
    numThreads?: number

    /**
     * Sherpa-ONNX execution provider.
     *
     * Defaults to {@code "cpu"}.
     */
    provider?: string

    /**
     * Whether Sherpa-ONNX debug output should be enabled.
     *
     * Defaults to {@code false}.
     */
    debug?: boolean

    /**
     * Whether inverse text normalization should be enabled.
     *
     * Inverse text normalization converts recognized spoken forms into more
     * conventional written forms when supported by the model.
     *
     * Defaults to {@code true}.
     */
    useInverseTextNormalization?: boolean
}


/**
 * CommonJS {@code require} function scoped to this ECMAScript module.
 *
 * It is needed because {@code sherpa-onnx-node} is loaded through the
 * CommonJS module system.
 */
const require = createRequire(import.meta.url)

/**
 * Loaded Sherpa-ONNX native Node.js module.
 */
const sherpaOnnx = require("sherpa-onnx-node") as SherpaOnnx

/**
 * Default directory containing the SenseVoice model files.
 */
const DEFAULT_MODEL_DIR = join(process.cwd(), "models", "sherpa-onnx")

/**
 * Default filename of the quantized SenseVoice ONNX model.
 */
const DEFAULT_MODEL_FILE = "model.int8.onnx"

/**
 * Default filename of the token vocabulary.
 */
const DEFAULT_TOKENS_FILE = "tokens.txt"

/**
 * Audio sample rate expected by the configured SenseVoice model.
 */
const DEFAULT_SAMPLE_RATE = 16000

/**
 * Number of acoustic feature dimensions expected by the model.
 */
const DEFAULT_FEATURE_DIM = 80


/**
 * Offline audio transcription service backed by Sherpa-ONNX and SenseVoice.
 *
 * The transcriber supports:
 *
 * - Reading and transcribing WAV files.
 * - Transcribing in-memory floating-point audio samples.
 * - Automatic or explicitly configured language recognition.
 * - Lazy recognizer initialization.
 *
 * The underlying recognizer is created only when the first transcription is
 * requested. The resulting recognizer promise is cached and reused by later
 * transcription operations.
 */
export class AudioTranscriber
{
    /**
     * Absolute path to the SenseVoice ONNX model file.
     */
    private readonly modelPath: string

    /**
     * Absolute path to the model token vocabulary file.
     */
    private readonly tokensPath: string

    /**
     * Recognition language passed to the SenseVoice model.
     */
    private readonly language: string

    /**
     * Number of threads used for recognition inference.
     */
    private readonly numThreads: number

    /**
     * Sherpa-ONNX execution provider.
     */
    private readonly provider: string

    /**
     * Indicates whether native recognizer debug output is enabled.
     */
    private readonly debug: boolean

    /**
     * Indicates whether inverse text normalization is enabled.
     */
    private readonly useInverseTextNormalization: boolean

    /**
     * Cached asynchronous recognizer initialization operation.
     *
     * The value remains {@code null} until the first transcription request.
     * Storing the promise ensures that simultaneous initialization requests
     * share the same recognizer creation operation.
     */
    private recognizer: Promise<OfflineRecognizer> | null

    /**
     * Constructs an audio transcriber.
     *
     * @param options           optional model path, language, runtime, and normalization configuration
     * @param options.modelDir  directory used to locate the default model and token files
     * @param options.modelPath explicit path to the SenseVoice ONNX model file
     * @param options.tokensPath    explicit path to the token vocabulary file
     * @param options.language  recognition language or {@code "auto"} for automatic detection
     * @param options.numThreads    number of inference threads; defaults to {@code 2}
     * @param options.provider  Sherpa-ONNX execution provider; defaults to {@code "cpu"}
     * @param options.debug     whether native debug output should be enabled
     * @param options.useInverseTextNormalization   whether recognized speech should be converted into normalized written
     *                                              text when supported
     */
    constructor(options: AudioTranscriberOptions = {})
    {
        const modelDir = options.modelDir ?? DEFAULT_MODEL_DIR

        this.modelPath = resolve(options.modelPath ?? join(modelDir, DEFAULT_MODEL_FILE))
        this.tokensPath = resolve(options.tokensPath ?? join(modelDir, DEFAULT_TOKENS_FILE))
        this.language = options.language ?? "auto"
        this.numThreads = options.numThreads ?? 2
        this.provider = options.provider ?? "cpu"
        this.debug = options.debug ?? false
        this.useInverseTextNormalization = options.useInverseTextNormalization ?? true
        this.recognizer = null
    }

    
    /**
     * Transcribes an audio file.
     *
     * The file is first decoded into floating-point waveform samples through
     * {@link readWaveFile}. The decoded samples are then passed to
     * {@link transcribeSamples}.
     *
     * @param audioPath         path to the WAV audio file to transcribe
     *
     * @return                  a promise resolving to the recognized and cleaned text
     *
     * @throws Error            if the audio file does not exist
     *
     * @throws                  if the file cannot be decoded, the recognizer cannot be initialized,
     *                          or speech recognition fails
     */
    async transcribeFile(audioPath: string): Promise<string>
    {
        const wave = readWaveFile(audioPath)
        return this.transcribeSamples(wave.samples, wave.sampleRate)
    }


    /**
     * Transcribes in-memory audio samples.
     *
     * A new recognition stream is created for the supplied waveform. The audio
     * samples and sample rate are submitted to that stream before asynchronous
     * decoding begins.
     *
     * @param samples           normalized floating-point waveform samples to transcribe
     * @param sampleRate        sample rate of {@code samples}, measured in hertz
     *
     * @return                  a promise resolving to the recognized text with leading and trailing
     *                          whitespace removed
     *
     * @throws                  if recognizer initialization or audio decoding fails
     */
    async transcribeSamples(samples: Float32Array, sampleRate: number): Promise<string>
    {
        const recognizer = await this.getRecognizer()
        const stream = recognizer.createStream()

        stream.acceptWaveform({
            samples,
            sampleRate,
        })

        const result = await recognizer.decodeAsync(stream)
        return this.cleanText(result.text ?? "")
    }


    /**
     * Returns the shared offline recognizer.
     *
     * The recognizer is initialized lazily. The initialization promise is
     * cached so that all later calls reuse the same recognizer instance.
     *
     * @return                  a promise resolving to the initialized offline recognizer
     *
     * @throws                  if recognizer creation fails
     */
    private async getRecognizer(): Promise<OfflineRecognizer>
    {
        if (!this.recognizer)
            this.recognizer = this.createRecognizer()

        return this.recognizer
    }


    /**
     * Validates model resources and creates the Sherpa-ONNX recognizer.
     *
     * The SenseVoice model and token vocabulary must both exist before native
     * recognizer initialization begins.
     *
     * @return                  a promise resolving to a configured offline recognizer
     *
     * @throws Error            if the model file or token vocabulary cannot be found
     * @throws                  if Sherpa-ONNX cannot load the model or create the recognizer
     */
    private async createRecognizer(): Promise<OfflineRecognizer>
    {
        this.assertFileExists(this.modelPath, "SenseVoice model")
        this.assertFileExists(this.tokensPath, "SenseVoice tokens")

        return sherpaOnnx.OfflineRecognizer.createAsync({
            featConfig: {
                sampleRate: DEFAULT_SAMPLE_RATE,
                featureDim: DEFAULT_FEATURE_DIM,
            },
            modelConfig: {
                senseVoice: {
                    model: this.modelPath,
                    language: this.language,
                    useInverseTextNormalization: this.useInverseTextNormalization ? 1 : 0,
                },
                tokens: this.tokensPath,
                numThreads: this.numThreads,
                debug: this.debug ? 1 : 0,
                provider: this.provider,
            },
        })
    }


    /**
     * Verifies that a required file exists.
     *
     * @param filePath          resolved path to the required file
     * @param name              human-readable resource name included in the error message
     *
     * @throws Error            if no file-system entry exists at {@code filePath}
     */
    private assertFileExists(filePath: string, name: string): void
    {
        if (!existsSync(filePath))
            throw new Error(`${name} not found: ${filePath}`)
    }


    /**
     * Normalizes recognized text before it is returned to callers.
     *
     * @param text              raw recognition result produced by Sherpa-ONNX
     *
     * @return                  the recognition result without leading or trailing whitespace
     */
    private cleanText(text: string): string
    {
        return text.trim()
    }
}


/**
 * Convenience function that creates an {@link AudioTranscriber} and
 * transcribes one audio file.
 *
 * A new transcriber and recognizer lifecycle is created for each invocation.
 * Applications that perform multiple transcriptions should normally reuse an
 * {@link AudioTranscriber} instance instead.
 *
 * @param audioPath             path to the WAV audio file to transcribe
 * @param options               optional transcriber model and runtime configuration
 *
 * @return                      a promise resolving to the recognized text
 *
 * @throws                      if the audio file cannot be read or speech recognition fails
 */
export async function audioToText(audioPath: string, options: AudioTranscriberOptions = {}): Promise<string>
{
    return new AudioTranscriber(options).transcribeFile(audioPath)
}


/**
 * Reads a WAV file into memory.
 *
 * The supplied path is converted into an absolute path before it is validated
 * and passed to Sherpa-ONNX.
 *
 * @param audioPath             absolute or relative path to the WAV file
 *
 * @return                      the decoded floating-point waveform and its sample rate
 *
 * @throws Error                if the resolved audio file does not exist
 *
 * @throws                      if Sherpa-ONNX cannot open or decode the file
 */
export function readWaveFile(audioPath: string): Waveform
{
    const filePath = resolve(audioPath)

    if (!existsSync(filePath))
        throw new Error(`audio file not found: ${filePath}`)

    return sherpaOnnx.readWave(filePath)
}
