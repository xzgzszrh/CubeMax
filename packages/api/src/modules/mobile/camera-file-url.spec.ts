import { mintCameraFileUrl, signCameraFile, verifyCameraFileSignature } from "./camera-file-url";

describe("camera file HMAC URLs", () => {
    const secret = "test-secret";

    it("accepts a matching signature and rejects a mutated one", () => {
        const fileId = "018f02a4-441c-7f3f-8a74-c82101911a90";
        const exp = 1_777_000_000;
        const sig = signCameraFile(fileId, exp, secret);
        expect(verifyCameraFileSignature(fileId, exp, sig, secret)).toBe(true);
        expect(verifyCameraFileSignature(fileId, exp, "0".repeat(64), secret)).toBe(false);
        expect(verifyCameraFileSignature(fileId, exp + 1, sig, secret)).toBe(false);
    });

    it("mints an absolute download path", () => {
        const minted = mintCameraFileUrl("018f02a4-441c-7f3f-8a74-c82101911a90", 3600, "https://max.sh.creativone.cn");
        expect(minted.url).toContain("/api/mobile/camera/files/018f02a4-441c-7f3f-8a74-c82101911a90?");
        expect(minted.url).toContain("sig=");
        expect(minted.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
});
