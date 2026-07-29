import { Cron } from "@buildingai/core/@nestjs/schedule";
import { ClassroomKitService } from "@buildingai/core/modules/classroom";
import { Injectable, Logger } from "@nestjs/common";

/**
 * 结束超时的课堂应用会话。
 *
 * 应用接管设备时改写了提示词并锁住了学生端。正常流程里应用会主动结束会话并
 * 恢复原配置，但老师直接关页面、应用崩溃、服务重启后没人重新接管这几种情况
 * 都会让接管悬在那里 —— 学生的方糖猫就永远停在游戏人设上，自己也改不回去。
 * 这个定时任务是那种情况下的唯一出路。
 */
@Injectable()
export class ClassroomSessionSweeperService {
    private readonly logger = new Logger(ClassroomSessionSweeperService.name);

    constructor(private readonly classroomKit: ClassroomKitService) {}

    @Cron("*/5 * * * *", { name: "classroom-session-sweep" })
    async sweep() {
        try {
            const { closed } = await this.classroomKit.sweepExpiredSessions();
            if (closed) this.logger.log(`Closed ${closed} expired classroom session(s)`);
        } catch (error) {
            this.logger.error(
                `Classroom session sweep failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}
