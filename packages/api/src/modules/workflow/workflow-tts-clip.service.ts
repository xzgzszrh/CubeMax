import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

type TtsClip = {
    buffer: Buffer;
    contentType: string;
    expiresAt: number;
};

@Injectable()
export class WorkflowTtsClipService {
    private readonly clips = new Map<string, TtsClip>();
    private readonly ttlMs = 5 * 60 * 1000;

    put(buffer: Buffer, contentType = "audio/wav"): string {
        this.prune();
        const token = randomUUID().replace(/-/g, "");
        this.clips.set(token, {
            buffer,
            contentType,
            expiresAt: Date.now() + this.ttlMs,
        });
        return token;
    }

    get(token: string): TtsClip {
        this.prune();
        const clip = this.clips.get(token);
        if (!clip) throw HttpErrorFactory.notFound("语音文件不存在或已过期");
        return clip;
    }

    publicUrl(token: string): string {
        const origin = (
            process.env.APP_DOMAIN ||
            process.env.VITE_PRODUCTION_APP_BASE_URL ||
            "https://max.sh.creativone.cn"
        ).replace(/\/$/, "");
        const prefix = (process.env.VITE_APP_WEB_API_PREFIX || "/api").replace(/\/$/, "");
        return `${origin}${prefix.startsWith("/") ? prefix : `/${prefix}`}/device-tts/${token}`;
    }

    private prune() {
        const now = Date.now();
        for (const [token, clip] of this.clips) {
            if (clip.expiresAt <= now) this.clips.delete(token);
        }
    }
}
