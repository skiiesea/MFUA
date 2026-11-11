# AFTERLIGHT

AFTERLIGHT is a first-person 3D survival game for Windows, built with Godot 4 and the Compatibility renderer.

## Development target

- Engine: Godot 4.x (project currently targets the Godot 4.3 project format)
- Renderer: Compatibility
- Language: GDScript
- Platform: Windows 10/11 x64
- Visual direction: stylized realism
- Initial performance target: 720p, stable 30 FPS on Intel Core i3-10100F, GeForce GT 1030 2 GB and 8 GB RAM.

## Current prototype

The first playable greybox has been replaced with a procedural first-look at the valley:

- A low-cost forest made from MultiMesh tree canopies and trunks.
- A service track leading toward Meteorological Station 04.
- A simple station exterior, distant hills, rocks, a pond and atmospheric fog.
- A first-person controller with mouse look, walking, sprinting and jumping.
- A small HUD with a crosshair, resource counters and interaction prompts.
- Four test resource pickups (wood and stone) that update the player's runtime inventory.

The scene uses built-in Godot meshes and materials. No external asset packs are required.

## Open the project

1. Install Godot 4.x.
2. Clone or pull the codex/afterlight branch.
3. Import afterlight/project.godot in Godot.
4. Run the project with F6/F5.
5. Click the game window to capture the mouse. Press Esc to release it.

## Controls

| Action | Key |
|---|---|
| Move | W, A, S, D |
| Look | Mouse |
| Sprint | Shift |
| Jump | Space |
| Pick up resource | E |
| Release mouse | Esc |
| Re-capture mouse | Left mouse button |

Look toward a wood or stone pickup until the interaction prompt appears, then press E. The HUD counters should increase and the pickup should disappear.

## Project structure

- project.godot — renderer, viewport and input actions.
- scenes/main.tscn — procedural valley entry scene.
- scenes/player.tscn — first-person player and interaction ray.
- scripts/player_controller.gd — movement, camera, HUD and runtime inventory.
- scripts/world_builder.gd — procedural environment and test pickups.
- scripts/resource_pickup.gd — resource interaction behavior.

## Performance principles

The forest uses MultiMesh for visible tree geometry, simple materials and no external high-resolution textures. Tree shadows are disabled to reduce GPU cost. The target PC still needs an in-game measurement pass; the 30 FPS target is not yet verified.

## Verification status

The repository changes have been written to the development branch. Godot is not available in the automation environment, so the project has **not** been imported, launched, or tested with the Godot editor/runtime here. Use the manual smoke-test checklist in docs/TESTING.md on the target PC before treating this prototype as verified.

## Scope

The valley is a foundation for later survival systems: gathering, crafting, building, needs, weather, time of day, radio story events and save/load. Those systems are not implemented yet.
