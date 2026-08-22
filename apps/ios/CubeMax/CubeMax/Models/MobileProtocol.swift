import Foundation

enum MobileProtocol {
    static let productConsentTitle = "是否授权 CubeCat 使用你的摄像头"
    static let capabilities = ["camera.photo"]
}

struct MobileEnvelope: Codable, Sendable {
    var v: Int
    var type: String
    var id: String
    var ts: String
    var replyTo: String?
    var data: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case v, type, id, ts, data
        case replyTo = "reply_to"
    }
}

extension MobileEnvelope {
    static func make(type: String, data: [String: JSONValue] = [:], replyTo: String? = nil) -> MobileEnvelope {
        MobileEnvelope(
            v: 1,
            type: type,
            id: UUID().uuidString.lowercased(),
            ts: Date.now.ISO8601Format(.init(includingFractionalSeconds: true)),
            replyTo: replyTo,
            data: data
        )
    }

    var sessionId: String? { data["session_id"]?.stringValue }
    var captureId: String? { data["capture_id"]?.stringValue }
    var title: String? { data["title"]?.stringValue }
    var facingDefault: String { data["facing_default"]?.stringValue ?? "back" }
    var allowSwitchFacing: Bool { data["allow_switch_facing"]?.boolValue ?? true }
    var jpegQuality: Double { data["jpeg_quality"]?.numberValue ?? 0.8 }
    var maxBytes: Int { Int(data["max_bytes"]?.numberValue ?? 2_097_152) }
    var maxEdgePx: Int { Int(data["max_edge_px"]?.numberValue ?? 1920) }
    var consentPrompt: String? { data["consent_prompt"]?.stringValue }
}
