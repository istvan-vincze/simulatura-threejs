import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Parse the actual shipped geometry. Only replace HTTP transport, so bounds,
// anchors, occlusion and resource cleanup checks exercise the exported model.
export function loadLocalCockpit() {
  const bytes = readFileSync("src/scene/assets/cockpit/interior.glb");
  return vi
    .spyOn(GLTFLoader.prototype, "loadAsync")
    .mockImplementation(function () {
      return new GLTFLoader().parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "",
      );
    });
}
