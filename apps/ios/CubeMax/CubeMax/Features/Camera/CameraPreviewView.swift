import AVFoundation
import SwiftUI

struct CameraPreviewView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            CameraPreviewRepresentable(layer: model.cameraController?.previewLayer)
                .ignoresSafeArea()
            VStack {
                HStack {
                    Button("关闭") { model.cancelCameraSession() }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.black.opacity(0.45), in: Capsule())
                    Spacer()
                    Text(model.cameraStatusText)
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.black.opacity(0.45), in: Capsule())
                }
                .foregroundStyle(.white)
                .padding()
                Spacer()
                if model.allowSwitchFacing {
                    HStack {
                        Spacer()
                        Button {
                            model.switchCameraFacing()
                        } label: {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.title2)
                                .padding(14)
                                .background(.black.opacity(0.45), in: Circle())
                        }
                        .disabled(model.cameraBusy)
                    }
                    .foregroundStyle(.white)
                    .padding()
                }
            }
        }
        .background(.black)
    }
}

struct CameraPreviewRepresentable: UIViewRepresentable {
    var layer: AVCaptureVideoPreviewLayer?

    func makeUIView(context: Context) -> PreviewView {
        PreviewView(previewLayer: layer)
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {
        uiView.previewLayer = layer
    }

    final class PreviewView: UIView {
        var previewLayer: AVCaptureVideoPreviewLayer? {
            didSet { attach() }
        }

        init(previewLayer: AVCaptureVideoPreviewLayer?) {
            self.previewLayer = previewLayer
            super.init(frame: .zero)
            backgroundColor = .black
            attach()
        }

        required init?(coder: NSCoder) { nil }

        override func layoutSubviews() {
            super.layoutSubviews()
            previewLayer?.frame = bounds
        }

        private func attach() {
            layer.sublayers?.forEach { $0.removeFromSuperlayer() }
            if let previewLayer {
                previewLayer.frame = bounds
                layer.addSublayer(previewLayer)
            }
        }
    }
}
