import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

@AppEntity({ name: "organization", comment: "教学组织（班级）" })
export class Organization extends SoftDeleteBaseEntity {
    @Column({ length: 80, comment: "组织名称" })
    name: string;

    @Index({ unique: true })
    @Column({ length: 20, comment: "组织编号" })
    code: string;

    @Index()
    @Column({ type: "uuid", comment: "创建人ID" })
    ownerId: string;

    @Column({ type: "boolean", default: true, comment: "是否启用" })
    isActive: boolean;

    @Column({
        type: "boolean",
        default: false,
        comment: "开启后成员只能看到被授权的应用，关闭时沿用全站应用中心",
    })
    appWhitelistEnabled: boolean;
}
