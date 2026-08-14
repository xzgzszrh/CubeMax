import { type ConsoleEsp32Device, useConsoleEsp32DevicesQuery } from "@buildingai/services/console";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Cpu, Wifi, WifiOff } from "lucide-react";

import { PageContainer } from "@/layouts/console/_components/page-container";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "从未连接";
}

function DeviceRow({ device }: { device: ConsoleEsp32Device }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{device.displayName}</TableCell>
      <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
      <TableCell>
        <Badge variant={device.online ? "default" : "outline"}>
          {device.online ? <Wifi /> : <WifiOff />}
          {device.online ? "在线" : "离线"}
        </Badge>
      </TableCell>
      <TableCell>{device.firmwareVersion || "-"}</TableCell>
      <TableCell>{device.capabilities.length ? device.capabilities.join(", ") : "-"}</TableCell>
      <TableCell>{formatDate(device.lastSeenAt)}</TableCell>
    </TableRow>
  );
}

export default function Esp32DeviceListPage() {
  const query = useConsoleEsp32DevicesQuery();
  const devices = query.data ?? [];

  return (
    <PageContainer>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-5" /> ESP32 设备
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>设备名称</TableHead>
                  <TableHead>设备 UUID</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>固件版本</TableHead>
                  <TableHead>能力</TableHead>
                  <TableHead>最后连接</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length ? (
                  devices.map((device) => <DeviceRow key={device.deviceId} device={device} />)
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      {query.isLoading ? "加载中..." : "暂无 ESP32 设备"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
