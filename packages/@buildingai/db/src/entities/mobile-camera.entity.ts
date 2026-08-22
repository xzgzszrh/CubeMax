import { Column, Entity, Index } from "../typeorm";

import { BaseEntity } from "./base";

export type CameraSessionStatus =
    | "created"
    | "notifying"
    | "waiting_for_device"
    | "awaiting_consent"
    | "previewing"
    | "capturing"
    | "closed"
    | "failed"
    | "cancelled"
    | "timed_out";

export type CameraCaptureStatus = "pending" | "uploading" | "succeeded" | "failed";

@Entity("mobile_installation")
@Index(["userId", "installationId"], { unique: true })
@Index(["installationId"])
export class MobileInstallation extends BaseEntity {
    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "installation_id", type: "varchar", length: 36 })
    installationId: string;

    @Column({ type: "varchar", length: 16, default: "ios" })
    platform: string;

    @Column({ name: "app_version", type: "varchar", length: 32, nullable: true })
    appVersion?: string | null;

    @Column({ name: "os_version", type: "varchar", length: 32, nullable: true })
    osVersion?: string | null;

    @Column({ name: "device_model", type: "varchar", length: 64, nullable: true })
    deviceModel?: string | null;

    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    capabilities: string[];

    @Column({ name: "last_seen_at", type: "timestamptz", nullable: true })
    lastSeenAt?: Date | null;

    @Column({ name: "superseded_at", type: "timestamptz", nullable: true })
    supersededAt?: Date | null;
}

@Entity("mobile_connection")
@Index(["connectionId"], { unique: true })
@Index(["userId", "installationId"])
export class MobileConnection extends BaseEntity {
    @Column({ name: "connection_id", type: "uuid" })
    connectionId: string;

    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "installation_id", type: "varchar", length: 36 })
    installationId: string;

    @Column({ name: "remote_address", type: "varchar", length: 100, nullable: true })
    remoteAddress?: string | null;

    @Column({ name: "connected_at", type: "timestamptz" })
    connectedAt: Date;

    @Column({ name: "disconnected_at", type: "timestamptz", nullable: true })
    disconnectedAt?: Date | null;

    @Column({ name: "close_code", type: "int", nullable: true })
    closeCode?: number | null;
}

@Entity("camera_session")
@Index(["workflowTaskId", "installationId"], { unique: true })
@Index(["userId", "createdAt"])
@Index(["installationId", "status"])
export class CameraSession extends BaseEntity {
    @Column({ name: "user_id", type: "uuid" })
    userId: string;

    @Column({ name: "installation_id", type: "varchar", length: 36 })
    installationId: string;

    @Column({ name: "workflow_task_id", type: "varchar", length: 64 })
    workflowTaskId: string;

    @Column({ name: "project_id", type: "uuid", nullable: true })
    projectId?: string | null;

    @Column({ name: "trigger_id", type: "uuid", nullable: true })
    triggerId?: string | null;

    @Column({ type: "varchar", length: 100, default: "" })
    title: string;

    @Column({ name: "node_ids", type: "jsonb", default: () => "'[]'::jsonb" })
    nodeIds: string[];

    @Column({ type: "varchar", length: 32, default: "created" })
    status: CameraSessionStatus;

    @Column({ name: "facing_default", type: "varchar", length: 8, default: "back" })
    facingDefault: string;

    @Column({ name: "allow_switch_facing", type: "bool", default: true })
    allowSwitchFacing: boolean;

    @Column({ type: "varchar", length: 16, default: "1080p" })
    resolution: string;

    @Column({ name: "jpeg_quality", type: "float", default: 0.8 })
    jpegQuality: number;

    @Column({ name: "max_bytes", type: "int", default: 2_097_152 })
    maxBytes: number;

    @Column({ name: "max_edge_px", type: "int", default: 1920 })
    maxEdgePx: number;

    @Column({ name: "consent_timeout_ms", type: "int", default: 60_000 })
    consentTimeoutMs: number;

    @Column({ name: "preview_max_ms", type: "int", default: 600_000 })
    previewMaxMs: number;

    @Column({ name: "image_url_ttl_sec", type: "int", default: 3600 })
    imageUrlTtlSec: number;

    @Column({ name: "pending_capture_id", type: "uuid", nullable: true })
    pendingCaptureId?: string | null;

    @Column({ type: "jsonb", nullable: true })
    error?: { code: string; message: string } | null;

    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt?: Date | null;

    @Column({ name: "ready_at", type: "timestamptz", nullable: true })
    readyAt?: Date | null;

    @Column({ name: "closed_at", type: "timestamptz", nullable: true })
    closedAt?: Date | null;

    @Column({ name: "consent_deadline_at", type: "timestamptz", nullable: true })
    consentDeadlineAt?: Date | null;

    @Column({ name: "preview_deadline_at", type: "timestamptz", nullable: true })
    previewDeadlineAt?: Date | null;
}

@Entity("camera_capture")
@Index(["sessionId", "nodeId"])
@Index(["expiresAt"])
export class CameraCapture extends BaseEntity {
    @Column({ name: "session_id", type: "uuid" })
    sessionId: string;

    @Column({ name: "node_id", type: "varchar", length: 64 })
    nodeId: string;

    @Column({ type: "varchar", length: 16, default: "pending" })
    status: CameraCaptureStatus;

    @Column({ name: "file_id", type: "uuid", nullable: true })
    fileId?: string | null;

    @Column({ name: "image_url", type: "varchar", length: 1024, nullable: true })
    imageUrl?: string | null;

    @Column({ type: "varchar", length: 64, nullable: true })
    sha256?: string | null;

    @Column({ type: "int", nullable: true })
    size?: number | null;

    @Column({ type: "int", nullable: true })
    width?: number | null;

    @Column({ type: "int", nullable: true })
    height?: number | null;

    @Column({ type: "varchar", length: 8, nullable: true })
    facing?: string | null;

    @Column({ name: "expires_at", type: "timestamptz", nullable: true })
    expiresAt?: Date | null;

    @Column({ type: "jsonb", nullable: true })
    error?: { code: string; message: string } | null;

    @Column({ name: "command_message_id", type: "varchar", length: 64, nullable: true })
    commandMessageId?: string | null;

    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt?: Date | null;
}
