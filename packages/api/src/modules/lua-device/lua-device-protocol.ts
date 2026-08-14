export function calculateLuaChunkCrc32(value: Buffer): string {
    let crc = 0xffffffff;
    for (const byte of value) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}
