# ESP-Claw Web Runtime

CubeMax bundles the prebuilt browser runtime from [espressif/esp-claw](https://github.com/espressif/esp-claw), commit `556e432d314c51de5285a4ae895ad3cdda5bade8`.

The upstream project and these runtime artifacts are provided under the Apache License 2.0. See `LICENSE-ESP-CLAW.txt` for the license text.

Bundled files:

- `esp_claw_sim.html`
- `esp_claw_sim.js`
- `esp_claw_sim.wasm`
- `esp_claw_sim.data`

CubeMax talks to the runtime through the documented `postMessage` protocol. The runtime is copied into this project so the application does not depend on the local `esp-claw` checkout.

To update during development, set `SIMULATOR_RUNTIME_SOURCE` to a directory containing the four artifacts and run `pnpm simulator:runtime:update` from `packages/client`.
