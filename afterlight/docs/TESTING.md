# AFTERLIGHT Godot smoke tests

## Automated CI checks

The workflow uses Godot 4.3.3 in headless mode.

- [ ] Project imports without script parse errors.
- [ ] Main scene instantiates.
- [ ] Player and valley resource nodes are created.
- [ ] Berry pickup updates inventory and records its pickup ID.
- [ ] Save file stores inventory and collected pickup IDs.
- [ ] A new scene instance restores inventory and does not respawn a collected pickup.

## Manual checks on the target Windows PC

### Import and launch

- [ ] Import `afterlight/project.godot` without resource errors.
- [ ] Run at 1280x720 using the Compatibility renderer.
- [ ] Confirm the player appears on the service track and the mouse is captured.

### Player controller

- [ ] W/A/S/D moves relative to camera yaw.
- [ ] Mouse movement rotates the view without exceeding vertical limits.
- [ ] Shift drains stamina; stamina regenerates when not sprinting.
- [ ] Space jumps only while grounded.
- [ ] Esc releases the mouse and left click captures it again.
- [ ] Player cannot pass through station walls or nearby tree trunks.

### Survival loop

- [ ] Collect the berry cluster with E.
- [ ] Press 1 and confirm berries decrease while hunger increases.
- [ ] Walk to the pond and press 2; thirst increases.
- [ ] Press 2 away from the pond; no water is consumed.
- [ ] Hunger and thirst decrease gradually; health decreases only when either reaches zero.

### Save/load

- [ ] Collect a pickup and press F5.
- [ ] Press F9 and confirm position, inventory and survival values restore.
- [ ] Confirm collected pickups remain absent after loading.
- [ ] Start a fresh run by deleting the save file from the user data directory.

### Performance

- [ ] Walk around the clearing for at least two minutes at 1280x720.
- [ ] Record average FPS and the lowest sustained FPS.
- [ ] Check GPU memory and system RAM use.
- [ ] If performance is below 30 FPS, reduce tree density and shadow distance first.

The automated checks do not validate real GPU performance, mouse feel or visual quality on the user's GT 1030 PC.


## Latest automated result — 25 November 2026

- [x] Godot 4.3.0 project import and script parse.
- [x] Main scene and player instantiate.
- [x] Berry pickup updates inventory and records its stable node ID.
- [x] Save/load restores inventory and prevents the collected berry pickup from returning.
- [x] Windows x64 export, artifact upload and preview release.

CI run: https://github.com/skiiesea/MFUA/actions/runs/45685645044

The headless dummy renderer emitted repeated null-mesh messages while the test scenes were being freed, but the smoke test and export both exited successfully. This is recorded for follow-up; graphical runtime behavior still needs checking on the target PC.
