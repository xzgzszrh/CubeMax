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

export type SimulatorSession = {
    id: string;
    userId: string;
    name: string;
    board: {
        type: "esp32-devkit-v1";
        name: "ESP32 DevKit V1";
        voltage: 3.3;
    };
    revision: number;
    pins: Record<string, VirtualPinState>;
    peripherals: VirtualPeripheralState;
    i2cDevices: Array<{ address: number; name: string }>;
    serialLog: SimulatorSerialEntry[];
    createdAt: string;
    updatedAt: string;
};

export type SimulatorOperation = {
    action: string;
    args: Record<string, unknown>;
};
