import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const CubeCatDeviceType = {
    UNKNOWN: "unknown",
    LITE: "CubeCat-Lite",
    S: "CubeCat-S",
} as const;

export type CubeCatDeviceTypeValue = (typeof CubeCatDeviceType)[keyof typeof CubeCatDeviceType];

export type CubeCatDeviceSettings = {
    volume: number;
    brightness: number;
    doNotDisturb: boolean;
};

@AppEntity({ name: "xiaozhi_device_profile", comment: "方糖猫设备本地资料" })
@Unique("UQ_xiaozhi_device_profile_agent_device", ["agentBindingId", "upstreamDeviceId"])
export class XiaozhiDeviceProfile extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "方糖猫智能体绑定ID" })
    agentBindingId: string;

    @Column({ type: "bigint", comment: "小智设备ID" })
    upstreamDeviceId: string;

    @Column({
        type: "varchar",
        length: 24,
        default: CubeCatDeviceType.UNKNOWN,
        comment: "管理员指定的方糖猫设备型号",
    })
    deviceType: CubeCatDeviceTypeValue;

    @Column({
        type: "jsonb",
        default: () => '\'{"volume":65,"brightness":70,"doNotDisturb":false}\'::jsonb',
        comment: "设备偏好设置，供后续硬件控制协议同步",
    })
    settings: CubeCatDeviceSettings;
}
