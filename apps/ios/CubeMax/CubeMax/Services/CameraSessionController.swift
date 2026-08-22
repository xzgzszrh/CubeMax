import AVFoundation
import ImageIO
import UIKit

final class CameraSessionController: NSObject, AVCapturePhotoCaptureDelegate {
    let previewLayer = AVCaptureVideoPreviewLayer()
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.cubemax.camera.session")
    private let photoOutput = AVCapturePhotoOutput()
    private var currentInput: AVCaptureDeviceInput?
    private var captureContinuation: CheckedContinuation<Data, Error>?
    private(set) var facing: AVCaptureDevice.Position = .back

    enum CameraError: LocalizedError {
        case unavailable
        case captureFailed
        var errorDescription: String? {
            switch self {
            case .unavailable: return "当前设备没有可用摄像头"
            case .captureFailed: return "拍照失败"
            }
        }
    }

    func start(facing: AVCaptureDevice.Position) async throws {
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        guard granted else { throw CameraError.unavailable }
        self.facing = facing
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async {
                do {
                    self.session.beginConfiguration()
                    self.session.sessionPreset = .photo
                    try self.installInput(position: facing)
                    if self.session.canAddOutput(self.photoOutput) {
                        self.session.addOutput(self.photoOutput)
                    }
                    self.photoOutput.isHighResolutionCaptureEnabled = true
                    self.previewLayer.session = self.session
                    self.previewLayer.videoGravity = .resizeAspectFill
                    self.session.commitConfiguration()
                    self.session.startRunning()
                    continuation.resume()
                } catch {
                    self.session.commitConfiguration()
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func stop() {
        queue.async {
            if self.session.isRunning { self.session.stopRunning() }
        }
    }

    func switchFacing() throws {
        facing = facing == .back ? .front : .back
        try installInput(position: facing)
    }

    func captureJPEG(quality: Double, maxEdge: Int, maxBytes: Int) async throws -> (data: Data, width: Int, height: Int) {
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        settings.flashMode = .off
        if photoOutput.isHighResolutionCaptureEnabled {
            settings.isHighResolutionPhotoEnabled = true
        }
        let data = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            queue.async {
                self.captureContinuation = continuation
                self.photoOutput.capturePhoto(with: settings, delegate: self)
            }
        }
        return try rewriteJPEG(data, quality: quality, maxEdge: maxEdge, maxBytes: maxBytes)
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error {
            captureContinuation?.resume(throwing: error)
            captureContinuation = nil
            return
        }
        guard let data = photo.fileDataRepresentation() else {
            captureContinuation?.resume(throwing: CameraError.captureFailed)
            captureContinuation = nil
            return
        }
        captureContinuation?.resume(returning: data)
        captureContinuation = nil
    }

    private func installInput(position: AVCaptureDevice.Position) throws {
        session.beginConfiguration()
        if let currentInput { session.removeInput(currentInput) }
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            session.commitConfiguration()
            throw CameraError.unavailable
        }
        session.addInput(input)
        currentInput = input
        session.commitConfiguration()
    }

    private func rewriteJPEG(_ data: Data, quality: Double, maxEdge: Int, maxBytes: Int) throws -> (data: Data, width: Int, height: Int) {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              var image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw CameraError.captureFailed
        }
        var width = image.width
        var height = image.height
        let longest = max(width, height)
        if longest > maxEdge {
            let scale = CGFloat(maxEdge) / CGFloat(longest)
            width = max(1, Int(CGFloat(width) * scale))
            height = max(1, Int(CGFloat(height) * scale))
            let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? image.colorSpace ?? CGColorSpaceCreateDeviceRGB()
            if let context = CGContext(
                data: nil,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: 0,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
            ) {
                context.interpolationQuality = .high
                context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
                if let resized = context.makeImage() { image = resized }
            }
        }
        var qualityValue = max(0.5, min(0.95, quality))
        var encoded = encodeJPEG(image, quality: qualityValue)
        while let current = encoded, current.count > maxBytes, qualityValue > 0.5 {
            qualityValue -= 0.1
            encoded = encodeJPEG(image, quality: max(0.5, qualityValue))
        }
        guard let jpeg = encoded, jpeg.count <= maxBytes else { throw CameraError.captureFailed }
        return (jpeg, width, height)
    }

    private func encodeJPEG(_ image: CGImage, quality: Double) -> Data? {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, "public.jpeg" as CFString, 1, nil) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: quality,
        ]
        CGImageDestinationAddImage(destination, image, options as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return data as Data
    }
}
