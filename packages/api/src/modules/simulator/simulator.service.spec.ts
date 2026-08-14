import { SimulatorService } from "./simulator.service";

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badRequest: (message: string) => new Error(message),
        notFound: (message: string) => new Error(message),
    },
}));

describe("SimulatorService", () => {
    let service: SimulatorService;

    beforeEach(() => {
        service = new SimulatorService();
    });

    it("creates isolated ESP32 sessions with board peripherals", () => {
        const first = service.create("student-a");
        const second = service.create("student-b");

        expect(first.board.type).toBe("esp32-devkit-v1");
        expect(first.peripherals.led.pin).toBe("2");
        expect(first.id).not.toBe(second.id);
        expect(service.list("student-a")).toHaveLength(1);
        expect(service.list("student-b")).toHaveLength(1);
    });

    it("stores the selected board model while sharing the simulator backend", async () => {
        const session = service.create("student", undefined, "cubecat-s3");

        expect(session.board).toMatchObject({ type: "cubecat-s3", name: "CubeCat-S3" });
        service.updateBoard(session.id, "student", "cubecat-p4");
        await service.executeTool("gpio_write", {
            sessionId: session.id,
            pin: "2",
            value: true,
        });

        expect(session.board).toMatchObject({ type: "cubecat-p4", name: "CubeCat-P4" });
        expect(session.peripherals.led.on).toBe(true);
    });

    it("applies GPIO, PWM, servo and input operations to the same session", async () => {
        const session = service.create("student");

        await service.executeTool("gpio_write", { sessionId: session.id, pin: "2", value: true });
        await service.executeTool("pwm_write", {
            sessionId: session.id,
            pin: "25",
            dutyCycle: 0.5,
            frequencyHz: 440,
        });
        await service.executeTool("servo_write_angle", {
            sessionId: session.id,
            pin: "26",
            angle: 135,
        });
        service.updateInput(session.id, "student", { type: "button", pressed: true });
        service.updateInput(session.id, "student", { type: "potentiometer", value: 3000 });

        const current = service.get(session.id);
        expect(current.peripherals.led.on).toBe(true);
        expect(current.peripherals.buzzer).toMatchObject({ active: true, frequencyHz: 440 });
        expect(current.peripherals.servo.angle).toBe(135);
        expect(
            await service.executeTool("gpio_read", { sessionId: session.id, pin: "0" }),
        ).toMatchObject({ value: true });
        expect(
            await service.executeTool("analog_read", { sessionId: session.id, pin: "34" }),
        ).toMatchObject({ value: 3000 });
    });

    it("resets in place so later batch operations use the live session", async () => {
        const session = service.create("student");
        const result = service.applyOperations(session.id, [
            { action: "gpio_write", args: { pin: "2", value: true } },
            { action: "reset_device", args: {} },
            { action: "gpio_write", args: { pin: "2", value: true } },
        ]);

        expect(result.peripherals.led.on).toBe(true);
        expect(service.get(session.id)).toBe(session);
    });
});
