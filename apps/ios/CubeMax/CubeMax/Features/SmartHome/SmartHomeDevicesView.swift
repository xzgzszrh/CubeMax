import SwiftUI

struct SmartHomeDevicesView: View {
    @EnvironmentObject private var model: AppModel
    let accountId: String?
    @State private var selectedDevice: XiaomiDevice?
    @State private var category = "全部"

    private var devices: [XiaomiDevice] {
        let source = accountId == nil ? model.devices : model.devices.filter { $0.accountId == accountId }
        guard category != "全部" else { return source }
        return source.filter { $0.categoryLabel == category }
    }

    private var categories: [String] {
        ["全部"] + Array(Set(model.devices.filter { accountId == nil || $0.accountId == accountId }.map(\.categoryLabel))).sorted()
    }

    var body: some View {
        Group {
            if devices.isEmpty { EmptyStateView(icon: "lightbulb.slash", title: "没有设备", message: "请先在“我的智能家居”中导入并同步小米账号。") }
            else {
                List {
                    if categories.count > 1 {
                        Section {
                            Picker("设备分类", selection: $category) {
                                ForEach(categories, id: \.self) { Text($0).tag($0) }
                            }
                            .pickerStyle(.menu)
                        }
                    }
                    Section {
                        ForEach(devices) { device in
                            Button { selectedDevice = device } label: { DeviceRow(device: device) }
                                .buttonStyle(.plain)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle(accountId == nil ? "全部设备" : "设备")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await model.loadSmartHome() } } label: { Image(systemName: "arrow.clockwise") }
                    .accessibilityLabel("刷新设备")
            }
        }
        .refreshable { await model.loadSmartHome() }
        .task { if model.devices.isEmpty { await model.loadSmartHome() } }
        .sheet(item: $selectedDevice) { device in DeviceControlView(device: device) }
    }
}

private struct DeviceRow: View {
    let device: XiaomiDevice

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: device.online ? "lightbulb.2.fill" : "lightbulb.slash")
                .foregroundStyle(device.online ? .orange : .secondary)
                .frame(width: 34, height: 34)
                .background((device.online ? Color.orange : Color.secondary).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(device.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text([device.homeName, device.roomName, device.categoryLabel].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Circle().fill(device.online ? .green : .gray).frame(width: 8, height: 8)
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 5)
    }
}
