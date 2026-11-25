# AFTERLIGHT development roadmap

## Godot 4 prototype foundation

- [x] Godot 4 project configured for Compatibility rendering.
- [x] First-person movement, mouse look, sprint and jump.
- [x] Procedural valley blockout with forest, service track, pond and Station 04.
- [x] Basic collision for ground, station walls and nearby tree trunks.
- [x] Resource pickup interaction for wood and stone.
- [x] Berry pickup, food consumption and pond drinking.
- [x] Hunger, thirst, health and stamina values with HUD.
- [x] Version 1 save/load for player state, inventory and collected pickup IDs.
- [ ] Import and headless scene/save smoke test on CI.
- [ ] Manual graphics/input smoke test on the target PC.
- [ ] Measure average and lowest FPS at 1280x720 on the GT 1030.

## Next: first campfire loop

- [ ] Add item definitions and simple inventory capacity rules.
- [ ] Add a campfire recipe (wood + stone).
- [ ] Place the campfire in front of the player with a valid-ground check.
- [ ] Add a low-cost flame/light effect and a simple interaction prompt.
- [ ] Save and restore the placed campfire.
- [ ] Test that materials are consumed only after successful placement.

## World systems

- [ ] Day/night cycle with low-cost lighting changes.
- [ ] Weather states and restrained rain/fog effects.
- [ ] Audio ambience, footsteps and interaction sounds.
- [ ] Versioned save migration as new systems are added.

## Story and expansion

- [ ] Radio receiver and first signal event.
- [ ] Exploration notes and environmental storytelling.
- [ ] Additional valley locations and research sites.
- [ ] New regions built as separate, streamable scenes.
