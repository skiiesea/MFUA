# AFTERLIGHT — native Windows prototype

This folder is the native C++ / raylib continuation of AFTERLIGHT. It is independent of the Godot project in `afterlight/`; the Godot files are intentionally preserved.

## Current prototype

- Native Windows x64 executable built with C++17 and raylib 5.5.
- First-person movement, mouse look, sprinting and jumping.
- A low-poly forest valley, service road, pond and Meteorological Station 04.
- Collectible wood and stone with a small inventory HUD.
- Local save/load: F5 saves; F9 starts a fresh run.
- Target profile: 1280×720, 30 FPS cap, low-cost primitive geometry.

This is an early playable foundation, not the finished survival game. Crafting, building, needs, weather simulation, story events, audio, polished assets and a full save system remain future work.

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
| E | Collect nearby resource |
| F5 | Save |
| F9 | Start a fresh run |
| H | Toggle help |
| Esc | Release mouse |

## Performance note

The prototype uses simple primitive meshes and a restrained scene. The 30 FPS cap is a target, not a verified performance result on the user's GT 1030 system. A real runtime pass on that machine is still required.
