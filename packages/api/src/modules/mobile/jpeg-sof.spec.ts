import { isJpegMagic, parseJpegDimensions } from "./jpeg-sof";

function jpegWithSof(width: number, height: number): Buffer {
    const sof = Buffer.alloc(19);
    sof[0] = 0xff;
    sof[1] = 0xd8;
    sof[2] = 0xff;
    sof[3] = 0xc0;
    sof.writeUInt16BE(17, 4);
    sof[6] = 8;
    sof.writeUInt16BE(height, 7);
    sof.writeUInt16BE(width, 9);
    sof[11] = 3;
    return sof;
}

describe("JPEG SOF parser", () => {
    it("reads SOF0 dimensions", () => {
        const buffer = jpegWithSof(1920, 1080);
        expect(isJpegMagic(buffer)).toBe(true);
        expect(parseJpegDimensions(buffer)).toEqual({ width: 1920, height: 1080 });
    });

    it("rejects non-JPEG", () => {
        expect(isJpegMagic(Buffer.from("heic"))).toBe(false);
        expect(parseJpegDimensions(Buffer.from([0x00, 0x00, 0x00]))).toBeNull();
    });
});
