import {
    assertNoPhoneCameraInsideLoop,
    collectPhoneCameraNodes,
    schemaHasOpenCameraOnWorkflowStart,
    schemaHasPhoneCamera,
} from "./phone-camera-schema";

describe("phone_camera schema walk", () => {
    it("finds top-level nodes and loop nesting", () => {
        const schema = {
            nodes: [
                { id: "start_1", type: "start", data: {} },
                {
                    id: "cam_1",
                    type: "phone_camera",
                    data: { openCameraOn: "workflow_start" },
                },
                {
                    id: "loop_1",
                    type: "loop",
                    blocks: [{ id: "cam_2", type: "phone_camera", data: {} }],
                },
            ],
        };
        const nodes = collectPhoneCameraNodes(schema);
        expect(nodes).toHaveLength(2);
        expect(nodes[0].inLoop).toBe(false);
        expect(nodes[1].inLoop).toBe(true);
        expect(schemaHasPhoneCamera(schema)).toBe(true);
        expect(schemaHasOpenCameraOnWorkflowStart(schema)).toBe(true);
        expect(() => assertNoPhoneCameraInsideLoop(schema)).toThrow(/循环/);
    });

    it("treats vision nodes as camera capture nodes", () => {
        const schema = {
            nodes: [{ id: "vision_1", type: "vision", data: {} }],
        };
        expect(schemaHasPhoneCamera(schema)).toBe(true);
        expect(schemaHasOpenCameraOnWorkflowStart(schema)).toBe(true);
    });

    it("treats all node_enter as no warmup start", () => {
        const schema = {
            nodes: [{ id: "cam_1", type: "phone_camera", data: { openCameraOn: "node_enter" } }],
        };
        expect(schemaHasOpenCameraOnWorkflowStart(schema)).toBe(false);
        expect(() => assertNoPhoneCameraInsideLoop(schema)).not.toThrow();
    });
});
