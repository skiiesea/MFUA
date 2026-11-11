# AFTERLIGHT

AFTERLIGHT is a first-person 3D survival game for Windows, built with Godot 4 and the Compatibility renderer.

## Development target

- Engine: Godot 4.x
- Renderer: Compatibility
- Language: GDScript
- Platform: Windows 10/11 x64
- Visual direction: stylized realism
- Initial performance target: 720p, stable 30 FPS on Intel Core i3-10100F, GeForce GT 1030 2 GB and 8 GB RAM.

## Current prototype

The initial project foundation contains a small test scene, a first-person character controller, mouse-look, jump, and a basic interaction ray. It intentionally uses built-in primitives so the project can be opened without downloading asset packs.

## Open the project

1. Install Godot 4.x.
2. Import `project.godot` from this folder.
3. Open the project and run the main scene with F6/F5.
4. Use WASD to move, mouse to look, Space to jump, E to interact (when an interactable is in range), and Esc to release the mouse.

## Project structure

- `project.godot` — project settings and input actions.
- `scenes/main.tscn` — initial greybox test environment.
- `scenes/player.tscn` — first-person player scene.
- `scripts/player_controller.gd` — movement, camera and interaction handling.

## Performance principles

Prefer Compatibility rendering, restrained real-time lighting, simple collision, level-of-detail for distant scenery, and measured profiling on the target PC. Visual effects and world size will be added incrementally.

## Scope and safety

The game is fictional entertainment software. Any future survival mechanics will be implemented as ordinary game systems, not real-world instructions.
