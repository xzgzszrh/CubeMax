import { Public } from "@buildingai/decorators/public.decorator";
import { SkipTransform } from "@buildingai/decorators";
import { WebController } from "@common/decorators/controller.decorator";
import { Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";

import { WorkflowTtsClipService } from "./workflow-tts-clip.service";

@SkipTransform()
@WebController({ path: "device-tts", skipAuth: true })
export class WorkflowTtsController {
    constructor(private readonly clips: WorkflowTtsClipService) {}

    @Public()
    @Get(":token")
    getClip(@Param("token") token: string, @Res() res: Response) {
        const clip = this.clips.get(token);
        res.setHeader("Content-Type", clip.contentType);
        res.setHeader("Cache-Control", "no-store");
        res.send(clip.buffer);
    }
}
