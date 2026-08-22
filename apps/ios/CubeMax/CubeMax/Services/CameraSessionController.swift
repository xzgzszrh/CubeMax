@preconcurrency import AVFoundation
import ImageIO
import UIKit

final class CameraSessionController: NSObject, AVCapturePhotoCaptureDelegate, @unchecked Sendable {
    let previewLayer = AVCaptureVideoPreviewLayer()
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.cubemax.camera.session")
    private let photoOutput = AVCapturePhotoOutput()
    private var currentInput: AVCaptureDeviceInput?
    private let continuationLock = NSLock()
    private var captureContinuation: CheckedContinuation<Data, Error>?
    private(set) var facing: AVCaptureDevice.Position = .back

    enum CameraError: LocalizedError, Sendable {
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
        let session = self.session
        let photoOutput = self.photoOutput
        let previewLayer = self.previewLayer
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            sessionQueue.async {
                do {
                    session.beginConfiguration()
                    session.sessionPreset = .photo
                    try self.installInput(position: facing)
                    if session.canAddOutput(photoOutput) {
                        session.addOutput(photoOutput)
                    }
                    self.configurePhotoDimensions(photoOutput)
                    previewLayer.session = session
                    previewLayer.videoGravity = .resizeAspectFill
                    session.commitConfiguration()
                    session.startRunning()
                    continuation.resume()
                } catch {
                    session.commitConfiguration()
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func stop() {
        let session = self.session
        sessionQueue.async {
            if session.isRunning { session.stopRunning() }
        }
    }

    func switchFacing() async throws {
        let next: AVCaptureDevice.Position = facing == .back ? .front : .back
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            sessionQueue.async {
                do {
                    try self.installInput(position: next)
                    self.facing = next
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func captureJPEG(quality: Double, maxEdge: Int, maxBytes: Int) async throws -> (data: Data, width: Int, height: Int) {
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        settings.flashMode = .off
        settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        let photoOutput = self.photoOutput
        let data = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            sessionQueue.async {
                self.continuationLock.lock()
                self.captureContinuation = continuation
                self.continuationLock.unlock()
                photoOutput.capturePhoto(with: settings, delegate: self)
            }
        }
        return try rewriteJPEG(data, quality: quality, maxEdge: maxEdge, maxBytes: maxBytes)
    }

    nonisolated func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        let result: Result<Data, Error>
        if let error {
            result = .failure(error)
        } else if let data = photo.fileDataRepresentation() {
            result = .success(data)
        } else {
            result = .failure(CameraError.captureFailed)
        }
        continuationLock.lock()
        let continuation = captureContinuation
        captureContinuation = nil
        continuationLock.unlock()
        switch result {
        case .success(let data):
            continuation?.resume(returning: data)
        case .failure(let error):
            continuation?.resume(throwing: error)
        }
    }

    private func configurePhotoDimensions(_ output: AVCapturePhotoOutput) {
        guard let device = currentInput?.device else { return }
        if let best = device.activeFormat.supportedMaxPhotoDimensions.last {
            output.maxPhotoDimensions = best
        }
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
