import CryptoKit
import Foundation

enum CameraCaptureUploader {
    static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func upload(
        api: APIClient,
        jpeg: Data,
        sessionId: String,
        captureId: String,
        facing: String,
        width: Int,
        height: Int
    ) async throws -> CameraCaptureUploadResponse {
        try await api.uploadCameraCapture(
            jpeg: jpeg,
            sessionId: sessionId,
            captureId: captureId,
            sha256: sha256Hex(jpeg),
            facing: facing,
            width: width,
            height: height
        )
    }
}
