import Foundation

/// A small Codable representation for the JSON values used by schemas, device state and metadata.
enum JSONValue: Codable, Hashable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    init(any value: Any) {
        switch value {
        case let value as String: self = .string(value)
        case let value as Bool: self = .bool(value)
        case let value as Int: self = .number(Double(value))
        case let value as Double: self = .number(value)
        case let value as Float: self = .number(Double(value))
        case let value as [String: Any]: self = .object(value.mapValues(JSONValue.init(any:)))
        case let value as [Any]: self = .array(value.map(JSONValue.init(any:)))
        default: self = .null
        }
    }

    var anyValue: Any {
        switch self {
        case .string(let value): return value
        case .number(let value): return value
        case .bool(let value): return value
        case .object(let value): return value.mapValues(\.anyValue)
        case .array(let value): return value.map(\.anyValue)
        case .null: return NSNull()
        }
    }

    var stringValue: String? {
        if case .string(let value) = self { return value }
        if case .number(let value) = self { return String(value) }
        if case .bool(let value) = self { return value ? "true" : "false" }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        if case .string(let value) = self { return Bool(value) }
        if case .number(let value) = self { return value != 0 }
        return nil
    }

    var numberValue: Double? {
        if case .number(let value) = self { return value }
        if case .string(let value) = self { return Double(value) }
        return nil
    }

    var prettyString: String {
        switch self {
        case .string(let value): return value
        case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
        case .bool(let value): return value ? "开" : "关"
        case .null: return "未设置"
        case .object, .array:
            guard let data = try? JSONEncoder().encode(self),
                  let value = String(data: data, encoding: .utf8) else { return "" }
            return value
        }
    }
}

extension JSONValue: Identifiable {
    var id: String { prettyString }
}
