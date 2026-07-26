import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import process from "node:process"


type Waveform = {
    samples: Float32Array
    sampleRate: number
}

type OfflineRecognizerResult = {
    text?: string
}

type OfflineStream = {
    acceptWaveform(waveform: Waveform): void
}


type OfflineRecognizer = {
    createStream(): OfflineStream
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>
}


type OfflineRecognizerConfig = {
    featConfig: {
        sampleRate: number
        featureDim: number
    }
    modelConfig: {
        senseVoice: {
            model: string
            language: string
            useInverseTextNormalization: number
        }
        tokens: string
        numThreads: number
        debug: number
        provider: string
    }
}


type SherpaOnnx = {
    OfflineRecognizer: {
        createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>
    }
    readWave(filePath: string): Waveform
}


export type AudioTranscriberOptions = {
    modelDir?: string
    modelPath?: string
    tokensPath?: string
    language?: string
    numThreads?: number
    provider?: string
    debug?: boolean
    useInverseTextNormalization?: boolean
}


const require = createRequire(import.meta.url)
const sherpaOnnx = require("sherpa-onnx-node") as SherpaOnnx

const DEFAULT_MODEL_NAME = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17"
const DEFAULT_MODEL_DIR = join(process.cwd(), "models", DEFAULT_MODEL_NAME)
const DEFAULT_MODEL_FILE = "model.int8.onnx"
const DEFAULT_TOKENS_FILE = "tokens.txt"
const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_FEATURE_DIM = 80


export class AudioTranscriber
{
    private readonly modelPath: string
    private readonly tokensPath: string
    private readonly language: string
    private readonly numThreads: number
    private readonly provider: string
    private readonly debug: boolean
    private readonly useInverseTextNormalization: boolean
    private recognizer: Promise<OfflineRecognizer> | null


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


    async transcribeFile(audioPath: string): Promise<string>
    {
        const filePath = resolve(audioPath)
        this.assertFileExists(filePath, "audio file")

        const wave = sherpaOnnx.readWave(filePath)
        return this.transcribeSamples(wave.samples, wave.sampleRate)
    }


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


    private async getRecognizer(): Promise<OfflineRecognizer>
    {
        if (!this.recognizer)
            this.recognizer = this.createRecognizer()

        return this.recognizer
    }


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


    private assertFileExists(filePath: string, name: string): void
    {
        if (!existsSync(filePath))
            throw new Error(`${name} not found: ${filePath}`)
    }


    private cleanText(text: string): string
    {
        return text.trim()
    }
}


export async function audioToText(audioPath: string, options: AudioTranscriberOptions = {}): Promise<string>
{
    return new AudioTranscriber(options).transcribeFile(audioPath)
}
