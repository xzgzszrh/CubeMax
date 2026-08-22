import Foundation
import Security

@MainActor
final class KeychainStore {
    static let shared = KeychainStore()

    private let service = "com.cubemax.mobile"
    private let account = "access-token"
    private let installationAccount = "installation-id"

    private init() {}

    func save(token: String) throws {
        try save(account: account, value: token)
    }

    func load() -> String? {
        load(account: account)
    }

    func delete() {
        delete(account: account)
    }

    func installationId() -> String {
        if let existing = load(account: installationAccount), !existing.isEmpty {
            return existing
        }
        let created = UUID().uuidString.lowercased()
        try? save(account: installationAccount, value: created)
        return load(account: installationAccount) ?? created
    }

    private func save(account: String, value: String) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let update: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            let addStatus = SecItemAdd(item as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainError(status: addStatus) }
        } else if status != errSecSuccess {
            throw KeychainError(status: status)
        }
    }

    private func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct KeychainError: LocalizedError {
    let status: OSStatus
    var errorDescription: String? { "无法保存登录凭据（(status)）" }
}
