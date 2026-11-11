# AFTERLIGHT manual smoke tests

Run these checks in Godot 4.x on the target Windows PC after importing the project.

## Import and launch

- [ ] Import afterlight/project.godot without parse or resource errors.
- [ ] Run the main scene.
- [ ] Confirm the game opens at 1280x720 using the Compatibility renderer.
- [ ] Confirm the player appears on the service track and the mouse is captured.

## Player controller

- [ ] W/A/S/D moves relative to the camera yaw.
- [ ] Mouse movement rotates the view without flipping past the vertical limits.
- [ ] Shift increases movement speed.
- [ ] Space jumps only while grounded.
- [ ] Esc releases the mouse and a left click captures it again.
- [ ] The player remains on the ground and cannot walk through nearby tree trunks or station walls.

## Valley scene

- [ ] The forest, service track, pond and Meteorological Station 04 appear.
- [ ] The station doorway is not blocked by its foundation.
- [ ] The HUD crosshair and resource counters remain visible.
- [ ] No repeated script errors appear in the debugger while moving around the clearing.

## Resource interaction

- [ ] Look toward each nearby pickup until the E prompt appears.
- [ ] Press E and confirm the pickup disappears.
- [ ] Wood and stone counters increase by the displayed amount.
- [ ] Looking away removes the interaction prompt.
- [ ] A pickup cannot be collected twice.

## Performance check

- [ ] Test at 1280x720 on the target PC.
- [ ] Record average FPS and the lowest sustained FPS after walking around the clearing for at least two minutes.
- [ ] Check GPU memory use and system RAM use.
- [ ] If performance is below 30 FPS, first reduce tree density and shadow distance before adding more visual effects.

## Current verification status

These are manual acceptance tests. They have not yet been run because the current automation environment does not contain the Godot editor or runtime.
