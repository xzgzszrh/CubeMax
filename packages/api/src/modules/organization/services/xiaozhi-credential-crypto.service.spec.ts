import { XiaozhiCredentialCryptoService } from "./xiaozhi-credential-crypto.service";

describe("XiaozhiCredentialCryptoService", () => {
    it("stores and reads credentials as plaintext", async () => {
        const service = new XiaozhiCredentialCryptoService();
        await service.ensureWritable();
        expect(service.encrypt("cookie=abc")).toBe("cookie=abc");
        expect(service.decrypt("cookie=abc")).toBe("cookie=abc");
    });

    it("rejects leftover AES payloads so the teacher can log in again", () => {
        const service = new XiaozhiCredentialCryptoService();
        expect(() => service.decrypt("x1.deadbeef.payload")).toThrow("重新登录");
    });
});
