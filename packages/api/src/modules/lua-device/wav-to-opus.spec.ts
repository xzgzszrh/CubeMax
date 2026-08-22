import {
    OPUS_FRAME_MS,
    OPUS_FRAME_SAMPLES,
    OPUS_SAMPLE_RATE,
    encodeWavToOpusFrames,
} from "./wav-to-opus";

function createWav(samples: Int16Array, sampleRate: number, channels = 1): Buffer {
    const dataSize = samples.length * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(channels, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * channels * 2, 28);
    buf.writeUInt16LE(channels * 2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);
    Buffer.from(samples.buffer, samples.byteOffset, dataSize).copy(buf, 44);
    return buf;
}

function sine(length: number, sampleRate: number, hz = 440): Int16Array {
    const samples = new Int16Array(length);
    for (let i = 0; i < length; i++) {
        samples[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / sampleRate) * 16000);
    }
    return samples;
}

describe("encodeWavToOpusFrames", () => {
    it("encodes 16 kHz mono 180 ms into three 60 ms frames", () => {
        const samples = sine(OPUS_FRAME_SAMPLES * 3, OPUS_SAMPLE_RATE);
        const encoded = encodeWavToOpusFrames(createWav(samples, OPUS_SAMPLE_RATE));
        expect(encoded.sampleRate).toBe(OPUS_SAMPLE_RATE);
        expect(encoded.frameDurationMs).toBe(OPUS_FRAME_MS);
        expect(encoded.frames).toHaveLength(3);
        expect(encoded.durationMs).toBe(180);
        for (const frame of encoded.frames) {
            expect(frame.length).toBeGreaterThan(0);
            expect(frame.length).toBeLessThanOrEqual(1500);
        }
    });

    it("resamples 24 kHz audio to 16 kHz / 60 ms frames", () => {
        const samples = sine(24000 * 0.18, 24000);
        const encoded = encodeWavToOpusFrames(createWav(samples, 24000));
        expect(encoded.frames).toHaveLength(3);
        expect(encoded.sampleRate).toBe(16_000);
    });

    it("mixes stereo down to mono before encoding", () => {
        const frames = OPUS_FRAME_SAMPLES;
        const stereo = new Int16Array(frames * 2);
        for (let i = 0; i < frames; i++) {
            stereo[i * 2] = 8000;
            stereo[i * 2 + 1] = -8000;
        }
        const encoded = encodeWavToOpusFrames(createWav(stereo, OPUS_SAMPLE_RATE, 2));
        expect(encoded.frames.length).toBeGreaterThanOrEqual(1);
    });

    it("rejects non-wav input", () => {
        expect(() => encodeWavToOpusFrames(Buffer.from("not a wav"))).toThrow(/WAV|无效/);
    });
});
