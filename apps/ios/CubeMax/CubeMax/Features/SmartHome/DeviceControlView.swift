import SwiftUI

struct DeviceControlView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let device: XiaomiDevice

    @State private var boolValues: [String: Bool]
    @State private var numberValues: [String: Double]
    @State private var selectedValues: [String: String]
    @State private var textValues: [String: String]
    @State private var actionValues: [String: String]
    @State private var activeControl: String?
    @State private var errorMessage: String?
    @State private var successMessage: String?

    private var liveDevice: XiaomiDevice {
        model.devices.first(where: { $0.id == device.id }) ?? device
    }

    private var writableProperties: [XiaomiCapability] {
        liveDevice.capabilities.filter { $0.kind == "property" && $0.canWrite }
    }

    private var actions: [XiaomiCapability] {
        liveDevice.capabilities.filter { $0.kind == "action" }
    }

    init(device: XiaomiDevice) {
        self.device = device
        var bools: [String: Bool] = [:]
        var numbers: [String: Double] = [:]
        var selected: [String: String] = [:]
        var text: [String: String] = [:]
        for capability in device.capabilities where capability.kind == "property" {
            let state = device.stateValue(for: capability)
            bools[capability.id] = state?.boolValue ?? false
            numbers[capability.id] = state?.numberValue ?? capability.valueRange?.min ?? 0
            selected[capability.id] = state?.prettyString ?? capability.valueList?.first?.value.prettyString ?? ""
            text[capability.id] = state?.stringValue ?? ""
        }
        _boolValues = State(initialValue: bools)
        _numberValues = State(initialValue: numbers)
        _selectedValues = State(initialValue: selected)
        _textValues = State(initialValue: text)
        _actionValues = State(initialValue: [:])
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 13) {
                        Image(systemName: liveDevice.online ? "lightbulb.2.fill" : "lightbulb.slash")
                            .font(.title2)
                            .foregroundStyle(liveDevice.online ? .orange : .secondary)
                            .frame(width: 48, height: 48)
                            .background((liveDevice.online ? Color.orange : Color.secondary).opacity(0.13), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(liveDevice.name).font(.headline)
                            Text([liveDevice.homeName, liveDevice.roomName].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Label(liveDevice.online ? "在线" : "离线", systemImage: "circle.fill")
                                .font(.caption2)
                                .foregroundStyle(liveDevice.online ? .green : .secondary)
                        }
                    }
                    .padding(.vertical, 5)
                }

                if writableProperties.isEmpty && actions.isEmpty {
                    Section { Text("该设备目前没有可控制的 MIoT 能力。") .foregroundStyle(.secondary) }
                }

                if !writableProperties.isEmpty {
                    Section("属性控制") {
                        ForEach(writableProperties) { capability in
                            propertyControl(capability)
                        }
                    }
                }

                if !actions.isEmpty {
                    Section("设备动作") {
                        ForEach(actions) { capability in
                            actionControl(capability)
                        }
                    }
                }

                if let successMessage {
                    Section { Label(successMessage, systemImage: "checkmark.circle.fill").foregroundStyle(.green) }
                }
            }
            .navigationTitle("设备控制")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { refresh() } label: {
                        if activeControl == "refresh" { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(activeControl != nil)
                }
            }
            .alert("控制失败", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("知道了") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    @ViewBuilder
    private func propertyControl(_ capability: XiaomiCapability) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(capability.description ?? capability.name).font(.subheadline.weight(.medium))
                    if let unit = capability.unit { Text(unit).font(.caption2).foregroundStyle(.secondary) }
                }
                Spacer()
                if activeControl == capability.id { ProgressView().controlSize(.small) }
            }

            if capability.format == "bool" {
                Toggle("", isOn: Binding(get: { boolValues[capability.id] ?? false }, set: { value in
                    boolValues[capability.id] = value
                    applyProperty(capability, value: .bool(value))
                }))
                .labelsHidden()
            } else if let options = capability.valueList, !options.isEmpty {
                HStack {
                    Picker("选择状态", selection: Binding(get: { selectedValues[capability.id] ?? options[0].value.prettyString }, set: { selectedValues[capability.id] = $0 })) {
                        ForEach(options) { option in Text(option.description).tag(option.value.prettyString) }
                    }
                    .pickerStyle(.menu)
                    Button("设置") {
                        let selected = selectedValues[capability.id]
                        if let value = options.first(where: { $0.value.prettyString == selected })?.value { applyProperty(capability, value: value) }
                    }
                    .buttonStyle(.bordered)
                }
            } else if let range = capability.valueRange {
                VStack(spacing: 6) {
                    HStack {
                        Slider(value: Binding(get: { numberValues[capability.id] ?? range.min }, set: { numberValues[capability.id] = $0 }), in: range.min...range.max, step: range.step)
                        Text(format(numberValues[capability.id] ?? range.min, unit: capability.unit))
                            .font(.caption.monospacedDigit())
                            .frame(minWidth: 55, alignment: .trailing)
                    }
                    Button("应用数值") { applyProperty(capability, value: .number(numberValues[capability.id] ?? range.min)) }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            } else {
                HStack {
                    TextField("输入值", text: Binding(get: { textValues[capability.id] ?? "" }, set: { textValues[capability.id] = $0 }))
                        .textFieldStyle(.roundedBorder)
                    Button("设置") {
                        if let value = parse(textValues[capability.id] ?? "", format: capability.format) { applyProperty(capability, value: value) }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.vertical, 5)
        .disabled(activeControl != nil)
    }

    @ViewBuilder
    private func actionControl(_ capability: XiaomiCapability) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(capability.description ?? capability.name).font(.subheadline.weight(.medium))
                Spacer()
                if activeControl == capability.id { ProgressView().controlSize(.small) }
            }
            ForEach(Array((capability.input ?? []).enumerated()), id: \.offset) { index, input in
                TextField(input.description ?? input.name, text: Binding(get: { actionValues["\(capability.id)-\(index)"] ?? "" }, set: { actionValues["\(capability.id)-\(index)"] = $0 }))
                    .textFieldStyle(.roundedBorder)
            }
            Button {
                runAction(capability)
            } label: {
                Label("执行", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .disabled(activeControl != nil)
        }
        .padding(.vertical, 5)
    }

    private func applyProperty(_ capability: XiaomiCapability, value: JSONValue) {
        guard activeControl == nil else { return }
        activeControl = capability.id
        successMessage = nil
        Task {
            do {
                try await model.setProperty(device: liveDevice, capability: capability, value: value)
                successMessage = "设备状态已更新"
            } catch { errorMessage = error.localizedDescription }
            activeControl = nil
        }
    }

    private func runAction(_ capability: XiaomiCapability) {
        var inputs: [JSONValue] = []
        for (index, input) in (capability.input ?? []).enumerated() {
            let text = actionValues["\(capability.id)-\(index)"] ?? ""
            guard let value = parse(text, format: input.format) else { return }
            inputs.append(value)
        }
        activeControl = capability.id
        successMessage = nil
        Task {
            do {
                try await model.executeAction(device: liveDevice, capability: capability, inputs: inputs)
                successMessage = "设备动作已执行"
            } catch { errorMessage = error.localizedDescription }
            activeControl = nil
        }
    }

    private func refresh() {
        activeControl = "refresh"
        Task {
            do {
                try await model.refreshDevice(liveDevice)
                successMessage = "设备状态已刷新"
            } catch { errorMessage = error.localizedDescription }
            activeControl = nil
        }
    }

    private func parse(_ text: String, format: String?) -> JSONValue? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if format == "bool" {
            if ["true", "1", "开"].contains(trimmed.lowercased()) { return .bool(true) }
            if ["false", "0", "关"].contains(trimmed.lowercased()) { return .bool(false) }
            errorMessage = "请输入 true/false 或 1/0"
            return nil
        }
        let numericFormats = ["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "float", "double"]
        if numericFormats.contains(format ?? "") {
            guard let number = Double(trimmed) else { errorMessage = "请输入有效数字"; return nil }
            return .number(number)
        }
        guard !trimmed.isEmpty else { errorMessage = "请输入参数"; return nil }
        return .string(trimmed)
    }

    private func format(_ value: Double, unit: String?) -> String {
        let number = value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value)
        return unit.map { "\(number) \($0)" } ?? number
    }
}
