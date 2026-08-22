export function isJpegMagic(buffer: Buffer): boolean {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export function isHeicMagic(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    const brand = buffer.subarray(4, 12).toString("ascii");
    return brand.includes("ftyp") || brand.includes("heic") || brand.includes("mif1");
}

export function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
    if (!isJpegMagic(buffer)) return null;
    let offset = 2;
    while (offset + 8 < buffer.length) {
        if (buffer[offset] !== 0xff) return null;
        const marker = buffer[offset + 1];
        if (marker === 0xd9 || marker === 0xda) return null;
        if (offset + 4 > buffer.length) return null;
        const size = buffer.readUInt16BE(offset + 2);
        if (size < 2) return null;
        if (marker === 0xc0 || marker === 0xc2) {
            if (offset + 9 > buffer.length) return null;
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            if (width < 1 || height < 1) return null;
            return { width, height };
        }
        offset += 2 + size;
    }
    return null;
}
