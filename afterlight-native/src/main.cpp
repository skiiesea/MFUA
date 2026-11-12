#include "raylib.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>

namespace {
constexpr int SCREEN_WIDTH = 1280;
constexpr int SCREEN_HEIGHT = 720;
constexpr float WORLD_LIMIT = 58.0f;

struct Pickup {
    Vector3 position;
    bool active;
    int type; // 0 = wood, 1 = stone
};

struct Player {
    Vector3 position{0.0f, 1.8f, -18.0f};
    float yaw = 0.0f;
    float pitch = 0.0f;
    float verticalVelocity = 0.0f;
    bool grounded = true;
    int wood = 0;
    int stone = 0;
};

float DistanceXZ(Vector3 a, Vector3 b) {
    const float dx = a.x - b.x;
    const float dz = a.z - b.z;
    return std::sqrt(dx * dx + dz * dz);
}

void DrawTree(float x, float z, float scale) {
    const float trunkHeight = 2.6f * scale;
    DrawCylinder({x, trunkHeight * 0.5f, z}, 0.18f * scale, 0.25f * scale,
                 trunkHeight, 7, Color{92, 68, 48, 255});
    DrawSphere({x, trunkHeight + 0.55f * scale, z}, 1.05f * scale,
               Color{52, 91, 62, 255});
    DrawSphere({x - 0.42f * scale, trunkHeight + 0.28f * scale, z + 0.12f * scale},
               0.72f * scale, Color{61, 105, 68, 255});
    DrawSphere({x + 0.40f * scale, trunkHeight + 0.30f * scale, z - 0.08f * scale},
               0.76f * scale, Color{45, 82, 57, 255});
}

void DrawWorld() {

    // Distant ridgelines frame the valley without expensive terrain shaders.
    for (int i = 0; i < 9; ++i) {
        const float x = -52.0f + static_cast<float>(i) * 13.0f;
        const float height = 13.0f + static_cast<float>((i * 7) % 5) * 2.0f;
        DrawCube({x, height * 0.42f, 69.0f}, 17.0f, height, 18.0f,
                 Color{91, 111, 105, 255});
        DrawCube({x + 4.0f, height * 0.34f, -75.0f}, 19.0f, height * 0.8f, 20.0f,
                 Color{102, 119, 111, 255});
    }

    DrawPlane({0.0f, 0.0f, 0.0f}, {150.0f, 150.0f}, Color{74, 91, 67, 255});

    // A pale service track leads from the forest to Station 04.
    DrawCube({0.0f, 0.025f, 8.0f}, 5.4f, 0.05f, 100.0f,
             Color{119, 111, 91, 255});

    // Forest is deliberately sparse and uses simple low-poly primitives.
    for (int x = -5; x <= 5; ++x) {
        for (int z = -5; z <= 5; ++z) {
            if (std::abs(x) <= 1 || (z >= -2 && z <= 1 && x >= -3 && x <= 3)) continue;
            const float px = static_cast<float>(x) * 9.0f + static_cast<float>((x * 13 + z * 5) % 3);
            const float pz = static_cast<float>(z) * 9.0f + static_cast<float>((z * 11 + x * 3) % 3);
            const float scale = 0.82f + static_cast<float>((x * x + z * z) % 4) * 0.09f;
            DrawTree(px, pz, scale);
        }
    }

    // Meteorological Station 04.
    DrawCube({0.0f, 2.1f, 31.0f}, 13.0f, 4.2f, 8.0f, Color{105, 111, 108, 255});
    DrawCube({0.0f, 4.35f, 31.0f}, 13.8f, 0.35f, 8.7f, Color{54, 62, 61, 255});
    DrawCube({-2.2f, 1.35f, 26.94f}, 1.5f, 2.7f, 0.12f, Color{46, 56, 56, 255});
    DrawCube({2.3f, 2.4f, 26.90f}, 2.0f, 1.4f, 0.12f, Color{65, 105, 115, 255});
    DrawCube({-4.5f, 5.0f, 31.0f}, 0.25f, 1.6f, 0.25f, Color{75, 80, 78, 255});
    DrawCylinder({-4.5f, 6.1f, 31.0f}, 0.0f, 0.65f, 0.7f, 8, Color{145, 151, 145, 255});

    // Small pond and shoreline.
    DrawCylinder({-24.0f, 0.04f, 23.0f}, 7.2f, 7.2f, 0.08f, 32,
                 Color{61, 105, 119, 255});
    DrawSphere({-30.0f, 0.16f, 19.0f}, 1.0f, Color{103, 105, 88, 255});
    DrawSphere({-18.0f, 0.16f, 28.0f}, 1.3f, Color{103, 105, 88, 255});
}

void SaveGame(const Player& player, const std::array<Pickup, 4>& pickups) {
    std::ofstream file("afterlight_save.txt", std::ios::trunc);
    if (!file) return;
    file << player.position.x << ' ' << player.position.y << ' ' << player.position.z << ' '
         << player.yaw << ' ' << player.wood << ' ' << player.stone << '\n';
    for (const auto& pickup : pickups) file << (pickup.active ? 1 : 0) << ' ';
}

void LoadGame(Player& player, std::array<Pickup, 4>& pickups) {
    std::ifstream file("afterlight_save.txt");
    if (!file) return;
    file >> player.position.x >> player.position.y >> player.position.z
         >> player.yaw >> player.wood >> player.stone;
    for (auto& pickup : pickups) {
        int active = 1;
        if (file >> active) pickup.active = active != 0;
    }
    player.position.y = 1.8f;
}

} // namespace

int main() {
    SetConfigFlags(FLAG_MSAA_4X_HINT);
    InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "AFTERLIGHT");
    SetTargetFPS(30);
    SetExitKey(KEY_NULL);
    DisableCursor();

    Player player;
    std::array<Pickup, 4> pickups{{
        {{-8.0f, 0.55f, -9.0f}, true, 0},
        {{11.0f, 0.55f, -5.0f}, true, 0},
        {{-13.0f, 0.55f, 7.0f}, true, 1},
        {{9.0f, 0.55f, 17.0f}, true, 1}
    }};
    LoadGame(player, pickups);

    bool showHelp = true;
    float messageTimer = 0.0f;
    const char* statusMessage = "";

    while (!WindowShouldClose()) {
        const float dt = std::min(GetFrameTime(), 0.05f);
        const Vector2 mouse = GetMouseDelta();
        player.yaw -= mouse.x * 0.0025f;
        player.pitch = std::clamp(player.pitch - mouse.y * 0.0022f, -1.35f, 1.35f);

        const Vector3 forward{std::sin(player.yaw), 0.0f, std::cos(player.yaw)};
        const Vector3 right{std::cosf(player.yaw), 0.0f, -std::sinf(player.yaw)};
        Vector3 movement{0.0f, 0.0f, 0.0f};
        if (IsKeyDown(KEY_W)) { movement.x += forward.x; movement.z += forward.z; }
        if (IsKeyDown(KEY_S)) { movement.x -= forward.x; movement.z -= forward.z; }
        if (IsKeyDown(KEY_D)) { movement.x += right.x; movement.z += right.z; }
        if (IsKeyDown(KEY_A)) { movement.x -= right.x; movement.z -= right.z; }

        const float movementLength = std::sqrt(movement.x * movement.x + movement.z * movement.z);
        if (movementLength > 0.001f) {
            const float speed = IsKeyDown(KEY_LEFT_SHIFT) ? 7.0f : 4.3f;
            player.position.x += movement.x / movementLength * speed * dt;
            player.position.z += movement.z / movementLength * speed * dt;
        }

        if (IsKeyPressed(KEY_SPACE) && player.grounded) {
            player.verticalVelocity = 5.2f;
            player.grounded = false;
        }
        player.verticalVelocity -= 14.0f * dt;
        player.position.y += player.verticalVelocity * dt;
        if (player.position.y <= 1.8f) {
            player.position.y = 1.8f;
            player.verticalVelocity = 0.0f;
            player.grounded = true;
        }

        player.position.x = std::clamp(player.position.x, -WORLD_LIMIT, WORLD_LIMIT);
        player.position.z = std::clamp(player.position.z, -WORLD_LIMIT, WORLD_LIMIT);

        int nearestPickup = -1;
        float nearestDistance = 2.5f;
        for (int i = 0; i < static_cast<int>(pickups.size()); ++i) {
            if (!pickups[static_cast<std::size_t>(i)].active) continue;
            const float distance = DistanceXZ(player.position, pickups[static_cast<std::size_t>(i)].position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPickup = i;
            }
        }

        if (nearestPickup >= 0 && IsKeyPressed(KEY_E)) {
            auto& pickup = pickups[static_cast<std::size_t>(nearestPickup)];
            pickup.active = false;
            if (pickup.type == 0) ++player.wood;
            else ++player.stone;
            statusMessage = "Resource collected / progress saved";
            messageTimer = 2.0f;
            SaveGame(player, pickups);
        }

        if (IsKeyPressed(KEY_F5)) {
            SaveGame(player, pickups);
            statusMessage = "Game saved";
            messageTimer = 2.0f;
        }
        if (IsKeyPressed(KEY_F9)) {
            player = Player{};
            for (auto& pickup : pickups) pickup.active = true;
            SaveGame(player, pickups);
            statusMessage = "New run started";
            messageTimer = 2.0f;
        }
        if (IsKeyPressed(KEY_H)) showHelp = !showHelp;
        if (IsKeyPressed(KEY_ESCAPE)) EnableCursor();
        if (!IsCursorHidden() && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) DisableCursor();

        Camera3D camera{};
        camera.position = player.position;
        const float cp = std::cosf(player.pitch);
        const Vector3 lookDirection{
            std::sinf(player.yaw) * cp,
            std::sinf(player.pitch),
            std::cosf(player.yaw) * cp
        };
        camera.target = {
            camera.position.x + lookDirection.x,
            camera.position.y + lookDirection.y,
            camera.position.z + lookDirection.z
        };
        camera.up = {0.0f, 1.0f, 0.0f};
        camera.fovy = 75.0f;
        camera.projection = CAMERA_PERSPECTIVE;

        BeginDrawing();
        ClearBackground(Color{133, 166, 180, 255});
        BeginMode3D(camera);
        DrawWorld();

        for (const auto& pickup : pickups) {
            if (!pickup.active) continue;
            const Color color = pickup.type == 0 ? Color{157, 111, 69, 255} : Color{133, 143, 149, 255};
            DrawCube(pickup.position, 0.8f, 0.8f, 0.8f, color);
            DrawCubeWires(pickup.position, 0.82f, 0.82f, 0.82f, Color{220, 220, 205, 255});
        }

        EndMode3D();

        DrawRectangle(18, 18, 240, 76, Fade(Color{14, 20, 20, 255}, 0.78f));
        DrawText("AFTERLIGHT", 32, 28, 24, RAYWHITE);
        DrawText(TextFormat("WOOD  %02i", player.wood), 32, 60, 16, Color{211, 177, 128, 255});
        DrawText(TextFormat("STONE %02i", player.stone), 132, 60, 16, Color{180, 190, 194, 255});

        DrawLine(SCREEN_WIDTH / 2 - 8, SCREEN_HEIGHT / 2, SCREEN_WIDTH / 2 + 8,
                 SCREEN_HEIGHT / 2, Fade(RAYWHITE, 0.85f));
        DrawLine(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 8, SCREEN_WIDTH / 2,
                 SCREEN_HEIGHT / 2 + 8, Fade(RAYWHITE, 0.85f));

        if (nearestPickup >= 0) {
            DrawRectangle(SCREEN_WIDTH / 2 - 105, SCREEN_HEIGHT / 2 + 28, 210, 34,
                          Fade(Color{12, 18, 18, 255}, 0.82f));
            DrawText("E  -  PICK UP RESOURCE", SCREEN_WIDTH / 2 - 91,
                     SCREEN_HEIGHT / 2 + 37, 16, RAYWHITE);
        }

        const Vector3 stationDirection{player.position.x, 0.0f, 31.0f - player.position.z};
        const float stationDistance = std::sqrt(stationDirection.x * stationDirection.x +
                                                stationDirection.z * stationDirection.z);
        DrawText(TextFormat("STATION 04  |  %im", static_cast<int>(stationDistance)),
                 SCREEN_WIDTH - 250, 24, 18, Color{228, 224, 203, 255});

        if (showHelp) {
            DrawRectangle(18, SCREEN_HEIGHT - 144, 355, 126, Fade(Color{14, 20, 20, 255}, 0.78f));
            DrawText("WASD  Move     SHIFT  Sprint", 32, SCREEN_HEIGHT - 130, 16, RAYWHITE);
            DrawText("SPACE  Jump    E  Collect", 32, SCREEN_HEIGHT - 104, 16, RAYWHITE);
            DrawText("F5  Save       F9  New run", 32, SCREEN_HEIGHT - 78, 16, RAYWHITE);
            DrawText("H  Hide help   ESC  Release mouse", 32, SCREEN_HEIGHT - 52, 15, Color{185, 195, 190, 255});
        }

        if (messageTimer > 0.0f) {
            messageTimer -= dt;
            DrawText(statusMessage, SCREEN_WIDTH / 2 - MeasureText(statusMessage, 18) / 2,
                     SCREEN_HEIGHT - 54, 18, Color{218, 211, 184, 255});
        }

        DrawFPS(SCREEN_WIDTH - 82, SCREEN_HEIGHT - 30);
        EndDrawing();
    }

    EnableCursor();
    CloseWindow();
    return 0;
}
