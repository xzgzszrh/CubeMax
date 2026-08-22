# CubeMax 手机摄像头协议（v1）

控制面：`wss://{host}/api/mobile-ws/v1`（JWT Upgrade，禁止 query token）。  
数据面：`POST /api/mobile/camera/captures`（JPEG multipart）。  
节点输出：HMAC 签名 URL `GET /api/mobile/camera/files/:fileId?exp=&sig=`，默认 TTL 3600s。

信封与 ESP32 同构：`{ v, type, id, ts, data, reply_to? }`，snake_case，仅文本帧。收到 binary 关闭 1003。

## Close code

| 码 | 含义 |
| --- | --- |
| 4401 | hello 超时 / 非法 hello |
| 4402 | 同安装被新连接替换 |
| 4403 | 未授权 / 令牌撤销（客户端清 token） |
| 1003 | binary frame |

## 客户端 → 服务端

`hello`、`device.status`、`camera.session.ready` / `rejected` / `cancel` / `state`、`camera.capture.accepted` / `result`、`error`。

hello `platform` 必须是 `"ios"`，`capabilities` 冻结 `["camera.photo"]`。

## 服务端 → 客户端

`hello.welcome`、`camera.session.start`、`camera.session.close`、`camera.capture`、`error`。

v1 不会下发 `camera.stream.*` / `camera.webrtc.*`。客户端若收到：回 `UNSUPPORTED_CAPABILITY` 且不断开。其它未知 type：`UNSUPPORTED_MESSAGE`。

## 图片回传

1. `camera.capture` 指令（用户不按快门）。
2. AVFoundation JPEG codec 截当前预览。
3. SHA-256（最终字节，小写 hex）+ multipart 上传。
4. 服务端校验魔数 `FF D8 FF`、SOF 尺寸、`timingSafeEqual(sha256)`、属主。
5. 写入本地磁盘 `File`，`description = phone_camera:{session}:{capture}`。
6. 铸造签名 URL；`camera_capture.status = succeeded` 后工作流节点解除阻塞。
7. `camera.capture.result` 仅元数据，丢失也不影响节点完成。

手机摄像头默认启用。代理需转发 `/api/mobile-ws/v1` 的 `Upgrade`、`Authorization`、`X-Installation-Id`。

直播预留：未来 `camera.stream.*` 必须新 path 或 v2，不得把 JPEG 塞进当前 JSON 通道。
