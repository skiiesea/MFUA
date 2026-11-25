# AFTERLIGHT

AFTERLIGHT is a first-person 3D survival game for Windows, built with Godot 4 and the Compatibility renderer.

## Development target

- Engine: Godot 4.3.x
- Renderer: Compatibility (OpenGL)
- Language: GDScript
- Platform: Windows 10/11 x64
- Visual direction: stylized realism
- Initial performance target: 1280x720 at stable 30 FPS on Intel Core i3-10100F, GeForce GT 1030 2 GB and 8 GB RAM.

## Current prototype

The current Godot branch contains:

- Procedural low-cost forest using MultiMesh trunks and canopies.
- Service track, pond, rocks, distant hills and Meteorological Station 04.
- First-person movement, mouse look, sprint and jump.
- Basic collision for the valley floor, station and nearby tree trunks.
- Runtime inventory for wood, stone and wild berries.
- Resource pickups that cannot be collected twice during a session.
- Hunger, thirst, health and stamina values with a compact HUD.
- Eating gathered berries restores hunger and a small amount of health.
- Drinking is available near the pond.
- F5 saves player position, view direction, inventory, survival values and collected pickup IDs.
- F9 loads the saved state and removes already collected pickups after the world is created.
- Versioned ConfigFile save format (version 1).

The environment still uses built-in Godot meshes and materials. There are no external asset packs or high-resolution textures.

## Open the project

1. Install Godot 4.3.x.
2. Open `afterlight/project.godot` in the Godot editor.
3. Run the main scene with F6 or the project with F5.
4. Click the game window to capture the mouse. Press Esc to release it.

## Controls

| Action | Key |
|---|---|
| Move | W, A, S, D |
| Look | Mouse |
| Sprint | Shift |
| Jump | Space |
| Pick up resource | E |
| Eat one berry | 1 |
| Drink near the pond | 2 |
| Save | F5 |
| Load | F9 |
| Release mouse | Esc |
| Re-capture mouse | Left mouse button |

## Performance principles

The forest uses MultiMesh for repeated geometry, simple materials and no external high-resolution textures. Tree shadows are disabled. The sun still casts shadows on the remaining scene; if the target PC falls below 30 FPS, reduce shadow distance and tree density before adding post-processing.

The 30 FPS target is not yet verified on the user's GT 1030 system. A real two-minute playtest at 1280x720 is still required.

## Verification

The GitHub Actions workflow runs a headless Godot 4.3.3 import/parse pass and a scene/save smoke test. This confirms project loading and scripted logic on the CI runner; it does not replace a graphics/input/performance test on the target PC.

## Next systems

Crafting recipes, campfire placement, building, weather, day/night, audio, radio story events and expanded research sites remain future work.
