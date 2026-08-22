import { Public } from "@buildingai/decorators/public.decorator";
import { SkipTransform } from "@buildingai/decorators";
import { Playground } from "@buildingai/decorators/playground.decorator";
import type { UserPlayground } from "@buildingai/db";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { File } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpError, HttpErrorFactory } from "@buildingai/errors";
import { WebController } from "@common/decorators/controller.decorator";
import { FileStorageService, FileUploadService } from "@buildingai/core/modules";
import {
    Body,
    Get,
    Headers,
    Param,
    Post,
    Query,
    Req,
    Res,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";

import { CameraSessionService } from "./camera-session.service";
import { verifyCameraFileSignature } from "./camera-file-url";
import { UUID_V4 } from "./mobile-protocol";

@WebController("mobile")
export class MobileController {
    constructor(
        private readonly cameraSessions: CameraSessionService,
        private readonly fileUploadService: FileUploadService,
        private readonly fileStorageService: FileStorageService,
        @InjectRepository(File)
        private readonly fileRepository: Repository<File>,
    ) {}

    @Get("config")
    config() {
        return { cameraEnabled: true };
    }

    @Get("installations")
    listInstallations(@Playground() user: UserPlayground) {
        return this.cameraSessions.listInstallations(user.id);
    }

    @Post("camera/captures")
    @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2_097_152 } }))
    async capture(
        @Playground() user: UserPlayground,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: Record<string, string>,
        @Headers("x-installation-id") installationId: string,
        @Req() request: Request,
    ) {
        if (!installationId || !UUID_V4.test(installationId.toLowerCase())) {
            throw HttpErrorFactory.badRequest("缺少 X-Installation-Id");
        }
        return this.cameraSessions.completeUpload({
            userId: user.id,
            installationId: installationId.toLowerCase(),
            sessionId: String(body.session_id || ""),
            captureId: String(body.capture_id || ""),
            sha256: String(body.sha256 || ""),
            facing: body.facing,
            file,
            request,
            fileUpload: (upload, req, description) =>
                this.fileUploadService.uploadFileToDisk(upload, req, description),
        });
    }

    @Public()
    @SkipTransform()
    @Get("camera/files/:fileId")
    async downloadSigned(
        @Param("fileId") fileId: string,
        @Query("exp") expRaw: string,
        @Query("sig") sig: string,
        @Req() request: Request,
        @Res() response: Response,
    ) {
        const ip = request.ip || request.socket.remoteAddress || "unknown";
        try {
            this.cameraSessions.noteDownload(ip);
        } catch (error) {
            return this.writeError(response, error);
        }
        const exp = Number(expRaw);
        if (!UUID_V4.test(fileId) || !Number.isFinite(exp)) {
            return response.status(400).json({ code: 40000, message: "签名无效" });
        }
        if (Math.floor(Date.now() / 1000) > exp) {
            return response.status(410).json({ code: 41000, message: "签名已过期" });
        }
        if (!verifyCameraFileSignature(fileId, exp, String(sig || ""))) {
            return response.status(403).json({ code: 40204, message: "签名校验失败" });
        }
        const file = await this.fileRepository.findOne({ where: { id: fileId } });
        if (!file || !file.description?.startsWith("phone_camera:") || !file.path) {
            return response.status(404).json({ code: 40400, message: "文件不存在" });
        }
        const stream = this.fileStorageService.createReadStream(file.path);
        if (!stream) {
            return response.status(404).json({ code: 40400, message: "文件不存在" });
        }
        response.setHeader("Content-Type", "image/jpeg");
        response.setHeader("Cache-Control", "private, no-store");
        stream.pipe(response);
    }

    private writeError(response: Response, error: unknown) {
        if (error instanceof HttpError) {
            return response.status(error.httpStatus).json({
                code: error.businessCode,
                message: error.message,
            });
        }
        return response.status(500).json({ code: 50000, message: "下载失败" });
    }
}
