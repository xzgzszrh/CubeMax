export type VirtualPinMode =
    | "input"
    | "output"
    | "input_pullup"
    | "input_pulldown"
    | "analog"
    | "pwm";

export type VirtualPinState = {
    mode: VirtualPinMode;
    digitalValue: boolean;
    analogValue: number;
    pwmDutyCycle: number;
    frequencyHz: number;
};

export type SimulatorSerialEntry = {
    id: number;
    direction: "input" | "output" | "system";
    text: string;
    createdAt: string;
};

export type VirtualPeripheralState = {
    led: { pin: string; on: boolean };
    button: { pin: string; pressed: boolean };
    potentiometer: { pin: string; value: number; max: number };
    buzzer: { pin: string; active: boolean; frequencyHz: number };
    servo: { pin: string; angle: number };
};

export type CubeCatDeviceState = {
    brightness: number;
    volume: number;
    lastVibrateMs: number;
    lastNotify: string;
    lastAlert: string;
    lastCameraQuestion: string;
    lastCameraAnswer: string;
    lastAudio: string;
};

/** CubeCat 屏幕像素：宽 480，高 800。竖屏，不要对调。 */
export const CUBECAT_SCREEN_WIDTH = 480;
export const CUBECAT_SCREEN_HEIGHT = 800;

export function createDefaultCubeCatState(): CubeCatDeviceState {
    return {
        brightness: 80,
        volume: 70,
        lastVibrateMs: 0,
        lastNotify: "",
        lastAlert: "",
        lastCameraQuestion: "",
        lastCameraAnswer: "",
        lastAudio: "",
    };
}

export const SIMULATOR_BOARD_TYPES = ["esp32-devkit-v1", "cubecat-s3", "cubecat-p4"] as const;

export type SimulatorBoardType = (typeof SIMULATOR_BOARD_TYPES)[number];

export type SimulatorSession = {
    id: string;
    userId: string;
    projectId?: string;
    name: string;
    board: {
        type: SimulatorBoardType;
        name: "ESP32 DevKit" | "CubeCat-S3" | "CubeCat-P4";
        voltage: 3.3;
    };
    revision: number;
    pins: Record<string, VirtualPinState>;
    peripherals: VirtualPeripheralState;
    cubecat: CubeCatDeviceState;
    i2cDevices: Array<{ address: number; name: string }>;
    serialLog: SimulatorSerialEntry[];
    createdAt: string;
    updatedAt: string;
};

export type SimulatorOperation = {
    action: string;
    args: Record<string, unknown>;
};
