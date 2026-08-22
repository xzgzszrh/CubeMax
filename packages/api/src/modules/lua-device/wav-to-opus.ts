import OpusScript = require("opusscript");

export const OPUS_SAMPLE_RATE = 16000;
export const OPUS_FRAME_MS = 60;
export const OPUS_FRAME_SAMPLES = (OPUS_SAMPLE_RATE * OPUS_FRAME_MS) / 1000;
const OPUS_BITRATE = 32_000;

export type OpusSpeakPayload = {
    frames: Buffer[];
    sampleRate: number;
    frameDurationMs: number;
    durationMs: number;
};

export function encodeWavToOpusFrames(wav: Buffer, volume = 100): OpusSpeakPayload {
    const pcm = parseWavPcm(wav);
    const mono = toMono(pcm.samples, pcm.channels);
    const resampled = resampleMono(mono, pcm.sampleRate, OPUS_SAMPLE_RATE);
    const scaled = applyVolume(resampled, volume);
    const frames = encodePcm16(scaled);
    if (frames.length === 0) {
        throw new Error("音频为空，无法编码 Opus");
    }
    return {
        frames,
        sampleRate: OPUS_SAMPLE_RATE,
        frameDurationMs: OPUS_FRAME_MS,
        durationMs: frames.length * OPUS_FRAME_MS,
    };
}

function parseWavPcm(wav: Buffer): { samples: Int16Array; sampleRate: number; channels: number } {
    if (wav.length < 44) throw new Error("音频数据无效");
    if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
        throw new Error("仅支持 WAV PCM");
    }

    let format = 0;
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let data: Buffer | undefined;
    let offset = 12;

    while (offset + 8 <= wav.length) {
        const id = wav.toString("ascii", offset, offset + 4);
        const size = wav.readUInt32LE(offset + 4);
        const start = offset + 8;
        const end = Math.min(wav.length, start + size);
        if (id === "fmt " && size >= 16) {
            format = wav.readUInt16LE(start);
            channels = wav.readUInt16LE(start + 2);
            sampleRate = wav.readUInt32LE(start + 4);
            bitsPerSample = wav.readUInt16LE(start + 14);
            if (format === 0xfffe && size >= 40) {
                format = wav.readUInt16LE(start + 24);
            }
        } else if (id === "data") {
            data = wav.subarray(start, end);
        }
        offset = start + size + (size % 2);
    }

    if (!data || !channels || !sampleRate || !bitsPerSample) {
        throw new Error("WAV 缺少有效的 fmt/data");
    }
    if (format !== 1 && format !== 3) {
        throw new Error("仅支持 PCM / IEEE float WAV");
    }

    const samples = decodePcm(data, format, bitsPerSample);
    if (samples.length < channels) throw new Error("WAV 采样数据为空");
    return { samples, sampleRate, channels };
}

function decodePcm(data: Buffer, format: number, bitsPerSample: number): Int16Array {
    if (format === 1 && bitsPerSample === 16) {
        const out = new Int16Array(Math.floor(data.length / 2));
        for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2);
        return out;
    }
    if (format === 1 && bitsPerSample === 8) {
        const out = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) out[i] = (data[i] - 128) << 8;
        return out;
    }
    if (format === 1 && bitsPerSample === 24) {
        const count = Math.floor(data.length / 3);
        const out = new Int16Array(count);
        for (let i = 0; i < count; i++) {
            const b0 = data[i * 3];
            const b1 = data[i * 3 + 1];
            const b2 = data[i * 3 + 2];
            let sample = (b0 | (b1 << 8) | (b2 << 16)) << 8;
            sample >>= 8;
            out[i] = Math.max(-32768, Math.min(32767, sample >> 8));
        }
        return out;
    }
    if ((format === 1 || format === 3) && bitsPerSample === 32) {
        const count = Math.floor(data.length / 4);
        const out = new Int16Array(count);
        for (let i = 0; i < count; i++) {
            const value = format === 3 ? data.readFloatLE(i * 4) : data.readInt32LE(i * 4) / 2147483648;
            out[i] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
        }
        return out;
    }
    throw new Error(`不支持的 WAV 位深: ${bitsPerSample}`);
}

function toMono(samples: Int16Array, channels: number): Int16Array {
    if (channels <= 1) return samples;
    const frames = Math.floor(samples.length / channels);
    const out = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
        let acc = 0;
        for (let channel = 0; channel < channels; channel++) {
            acc += samples[i * channels + channel];
        }
        out[i] = Math.max(-32768, Math.min(32767, Math.round(acc / channels)));
    }
    return out;
}

function resampleMono(input: Int16Array, fromRate: number, toRate: number): Int16Array {
    if (fromRate === toRate) return input;
    if (input.length === 0) return input;
    const outLen = Math.max(1, Math.round((input.length * toRate) / fromRate));
    const out = new Int16Array(outLen);
    const last = input.length - 1;
    for (let i = 0; i < outLen; i++) {
        const src = (i * fromRate) / toRate;
        const i0 = Math.min(last, Math.floor(src));
        const i1 = Math.min(last, i0 + 1);
        const frac = src - i0;
        out[i] = Math.max(
            -32768,
            Math.min(32767, Math.round(input[i0] * (1 - frac) + input[i1] * frac)),
        );
    }
    return out;
}

function applyVolume(samples: Int16Array, volume: number): Int16Array {
    const gain = Math.max(0, Math.min(100, volume)) / 100;
    if (gain === 1) return samples;
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain)));
    }
    return out;
}

function encodePcm16(samples: Int16Array): Buffer[] {
    const encoder = createEncoder();
    try {
        encoder.setBitrate(OPUS_BITRATE);
        const frames: Buffer[] = [];
        const frameBytes = OPUS_FRAME_SAMPLES * 2;
        const padded = new Int16Array(
            Math.ceil(Math.max(samples.length, 1) / OPUS_FRAME_SAMPLES) * OPUS_FRAME_SAMPLES,
        );
        padded.set(samples);
        const pcm = Buffer.from(padded.buffer, padded.byteOffset, padded.byteLength);
        for (let offset = 0; offset < pcm.length; offset += frameBytes) {
            const packet = encoder.encode(pcm.subarray(offset, offset + frameBytes), OPUS_FRAME_SAMPLES);
            if (!packet.length) continue;
            frames.push(Buffer.from(packet));
        }
        return frames;
    } finally {
        encoder.delete();
    }
}

function createEncoder(): InstanceType<typeof OpusScript> {
    try {
        return new OpusScript(OPUS_SAMPLE_RATE, 1, OpusScript.Application.AUDIO);
    } catch {
        return new OpusScript(OPUS_SAMPLE_RATE, 1, OpusScript.Application.AUDIO, { wasm: false });
    }
}
