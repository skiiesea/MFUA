# AFTERLIGHT — native Windows prototype

This is the only actively developed AFTERLIGHT game: a native C++17 / raylib Windows project. Godot is not required, used, or part of the build pipeline.

## Current prototype

- Native Windows x64 executable built with C++17 and raylib 5.5.
- First-person movement, mouse look, sprinting and jumping.
- Forest valley, service road, pond and Meteorological Station 04, with procedural tiled terrain/gravel/concrete textures, denser ground detail and atmospheric sky gradient.
- Field inventory with wood, stone and wild berries.
- Survival needs: health, hunger, thirst and sprint stamina.
- Resource gathering, raw berry consumption, pond water interaction and campfire crafting.
- Campfire cooking loop: use E near a placed campfire to cook gathered berries; press 2 to eat cooked food for a larger hunger recovery and a small health recovery.
- Dynamic day/night cycle and periodic rain.
- Versioned local save/load: F5 saves; F9 starts a fresh run. Version 3 stores cooked food and camera pitch, validates loaded values, and still reads existing version 2 saves.
- Target profile: 1280×720, 30 FPS cap, low-cost primitive geometry.

This is an early playable foundation, not the finished survival game. Advanced crafting, building, story events, spatial audio, high-quality texture assets and expanded locations remain future work.

## Build on Windows

Install Visual Studio 2022 with the Desktop development with C++ workload and CMake, then run:

```powershell
cmake -S afterlight-native -B build -A x64 -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel
```

The CMake project fetches raylib 5.5 automatically. The executable is produced under the build directory.

## Download a ready build

The GitHub Actions workflow `.github/workflows/afterlight-native-windows.yml` builds the x64 Release executable on a Windows runner and publishes it as the `AFTERLIGHT-Windows` artifact. The game does not require Godot or the Godot editor.

## Controls

| Key | Action |
|---|---|
| W / A / S / D | Move |
| Mouse | Look |
| Left Shift | Sprint |
| Space | Jump |
| E | Collect nearby resource / cook berries at campfire |
| F | Drink at pond / inspect station |
| I | Toggle inventory |
| 1 | Eat raw berries |
| 2 | Eat cooked berries |
| C | Craft and place campfire (3 wood + 2 stone) |
| F5 | Save |
| F9 | Start a fresh run |
| H | Toggle help |
| Esc | Release mouse |

## Performance note

The prototype uses lightweight procedural textures and primitive geometry rather than high-poly scanned assets. The 30 FPS cap is a target, not a verified performance result on the user's GT 1030 system. A real runtime pass on that machine is still required.
