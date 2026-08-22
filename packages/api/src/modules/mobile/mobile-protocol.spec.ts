import { errorCodeForUnknownType, parseEnvelope } from "./mobile-protocol";

describe("mobile protocol envelope", () => {
    it("parses a v1 envelope and ignores extra fields", () => {
        const parsed = parseEnvelope({
            v: 1,
            type: "hello",
            id: "a",
            ts: "2026-08-22T10:00:00.000Z",
            extra: true,
            data: { installation_id: "x", ignored: 1 },
        });
        expect(parsed?.type).toBe("hello");
        expect(parsed?.data.installation_id).toBe("x");
    });

    it("classifies reserved stream types", () => {
        expect(errorCodeForUnknownType("camera.stream.start")).toBe("UNSUPPORTED_CAPABILITY");
        expect(errorCodeForUnknownType("camera.webrtc.offer")).toBe("UNSUPPORTED_CAPABILITY");
        expect(errorCodeForUnknownType("nope")).toBe("UNSUPPORTED_MESSAGE");
    });
});
