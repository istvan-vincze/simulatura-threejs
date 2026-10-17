// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { createTown } from "../src/scene/town";
import { goalPose } from "../src/domain/movements";

it("switches guide direction and goal between the left turn and straight lessons", () => {
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      fillRect() {},
      fillText() {},
    } as unknown as CanvasRenderingContext2D);
  try {
    const town = createTown();
    const straight = town.route.getObjectByName("route-south-north")!;
    const turn = town.route.getObjectByName("route-south-west")!;
    const goal = town.root.getObjectByName("lesson-goal")!;
    for (const id of [
      "left-turn",
      "stop",
      "left-turn",
      "signals",
      "priority",
    ] as const) {
      town.setScenario(id);
      town.root.updateMatrixWorld(true);
      const turning = id === "left-turn";
      expect(turn.visible).toBe(turning);
      expect(straight.visible).toBe(!turning);
      const target = goalPose(turning ? "south-west" : "south-north");
      expect(goal.position.x).toBeCloseTo(target.x);
      expect(goal.position.z).toBeCloseTo(target.z);
      const finalArrow = (turning ? turn : straight).children.at(-1)!;
      const direction = new THREE.Vector3(0, 1, 0).transformDirection(
        finalArrow.matrixWorld,
      );
      expect(direction.x).toBeCloseTo(Math.sin(target.yaw));
      expect(direction.z).toBeCloseTo(-Math.cos(target.yaw));
      const acrossGate = new THREE.Vector3(1, 0, 0).transformDirection(
        goal.matrixWorld,
      );
      expect(acrossGate.dot(direction)).toBeCloseTo(0);
    }
  } finally {
    context.mockRestore();
  }
});
