import SwiftUI

struct TriggerFormView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let trigger: ProgrammingTriggerItem

    @State private var textValues: [String: String]
    @State private var boolValues: [String: Bool]
    @State private var enumValues: [String: String]
    @State private var errorMessage: String?
    @State private var resultMessage: String?
    @State private var isRunning = false

    private var fields: [SchemaField] {
        (trigger.inputSchema.properties ?? [:])
            .map { SchemaField(name: $0.key, schema: $0.value) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    init(trigger: ProgrammingTriggerItem) {
        self.trigger = trigger
        var text: [String: String] = [:]
        var bool: [String: Bool] = [:]
        var enums: [String: String] = [:]
        for (name, schema) in trigger.inputSchema.properties ?? [:] {
            if let value = schema.defaultValue {
                text[name] = value.stringValue ?? value.prettyString
                bool[name] = value.boolValue ?? false
                enums[name] = value.prettyString
            } else if schema.isBoolean {
                bool[name] = false
            } else if let first = schema.enumValues?.first {
                enums[name] = first.prettyString
            } else {
                text[name] = ""
            }
        }
        _textValues = State(initialValue: text)
        _boolValues = State(initialValue: bool)
        _enumValues = State(initialValue: enums)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(trigger.name).font(.title3.weight(.bold))
                        Text(trigger.project.name).font(.subheadline).foregroundStyle(.secondary)
                        if let description = trigger.description, !description.isEmpty {
                            Text(description).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 5)
                }

                if fields.isEmpty {
                    Section { Text("这个工程不需要输入参数，点击运行即可。").foregroundStyle(.secondary) }
                } else {
                    ForEach(fields) { field in
                        Section {
                            fieldEditor(field)
                        } header: {
                            HStack(spacing: 4) {
                                Text(field.schema.title ?? field.name)
                                if trigger.inputSchema.required?.contains(field.name) == true { Text("*").foregroundStyle(.red) }
                            }
                        } footer: {
                            if let description = field.schema.description { Text(description) }
                        }
                    }
                }

                if let errorMessage {
                    Section { Label(errorMessage, systemImage: "exclamationmark.circle").foregroundStyle(.red) }
                }
                if let resultMessage {
                    Section {
                        Label(resultMessage, systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                    }
                }

                Section {
                    Button(action: submit) {
                        HStack {
                            Spacer()
                            if isRunning { ProgressView() }
                            else { Label("运行工程", systemImage: "play.fill").fontWeight(.semibold) }
                            Spacer()
                        }
                    }
                    .disabled(isRunning)
                }
            }
            .navigationTitle("运行触发器")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
            }
        }
    }

    @ViewBuilder
    private func fieldEditor(_ field: SchemaField) -> some View {
        let schema = field.schema
        let name = field.name
        if schema.isBoolean {
            Toggle(name, isOn: Binding(get: { boolValues[name] ?? false }, set: { boolValues[name] = $0 }))
        } else if let options = schema.enumValues, !options.isEmpty {
            Picker(name, selection: Binding(get: { enumValues[name] ?? options[0].prettyString }, set: { enumValues[name] = $0 })) {
                ForEach(options, id: \.self) { option in
                    Text(option.prettyString).tag(option.prettyString)
                }
            }
        } else if schema.type == "object" || schema.type == "array" || schema.type == "map" {
            TextEditor(text: Binding(get: { textValues[name] ?? "" }, set: { textValues[name] = $0 }))
                .frame(minHeight: 90)
                .font(.system(.body, design: .monospaced))
                .overlay(alignment: .topLeading) {
                    if (textValues[name] ?? "").isEmpty {
                        Text(schema.type == "array" ? "输入 JSON 数组" : "输入 JSON 对象")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .allowsHitTesting(false)
                    }
                }
        } else if schema.isNumber {
            TextField("输入数值", text: Binding(get: { textValues[name] ?? "" }, set: { textValues[name] = $0 }))
                .keyboardType(.decimalPad)
        } else {
            TextField("输入内容", text: Binding(get: { textValues[name] ?? "" }, set: { textValues[name] = $0 }))
                .textInputAutocapitalization(.sentences)
        }
    }

    private func submit() {
        errorMessage = nil
        resultMessage = nil
        guard let inputs = makeInputs() else { return }
        isRunning = true
        Task {
            do {
                let taskId = try await model.executeTrigger(trigger, inputs: inputs)
                resultMessage = "已开始运行，任务 ID：\(taskId)"
            } catch {
                errorMessage = error.localizedDescription
            }
            isRunning = false
        }
    }

    private func makeInputs() -> [String: JSONValue]? {
        var result: [String: JSONValue] = [:]
        let required = Set(trigger.inputSchema.required ?? [])
        for field in fields {
            let name = field.name
            let schema = field.schema
            if schema.isBoolean {
                result[name] = .bool(boolValues[name] ?? false)
                continue
            }
            if let options = schema.enumValues, !options.isEmpty {
                let selected = enumValues[name] ?? options[0].prettyString
                result[name] = options.first(where: { $0.prettyString == selected }) ?? .string(selected)
                continue
            }
            let text = (textValues[name] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty {
                if required.contains(name) {
                    errorMessage = "请填写「\(schema.title ?? name)」"
                    return nil
                }
                continue
            }
            if schema.type == "object" || schema.type == "array" || schema.type == "map" {
                guard let data = text.data(using: .utf8), let value = try? JSONDecoder().decode(JSONValue.self, from: data) else {
                    errorMessage = "「\(schema.title ?? name)」不是有效的 JSON"
                    return nil
                }
                result[name] = value
            } else if schema.type == "integer" {
                guard let value = Int(text) else { errorMessage = "「\(schema.title ?? name)」应为整数"; return nil }
                result[name] = .number(Double(value))
            } else if schema.type == "number" {
                guard let value = Double(text) else { errorMessage = "「\(schema.title ?? name)」应为数字"; return nil }
                result[name] = .number(value)
            } else {
                result[name] = .string(text)
            }
        }
        return result
    }
}

private struct SchemaField: Identifiable {
    let name: String
    let schema: JSONSchema
    var id: String { name }
}
