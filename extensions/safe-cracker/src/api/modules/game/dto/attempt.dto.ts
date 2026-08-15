import { IsString, Length } from "class-validator";

import type { AttemptPayload } from "../../../shared/contract";

export class AttemptDto implements AttemptPayload {
    @IsString({ message: "密码必须是文本" })
    @Length(1, 32, { message: "密码长度不合法" })
    password: string;
}
