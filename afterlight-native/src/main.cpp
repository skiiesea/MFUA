#include "raylib.h"
#include "raymath.h"
#include "rlgl.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <string>

namespace {
constexpr int SCREEN_WIDTH = 1280;
constexpr int SCREEN_HEIGHT = 720;
constexpr float WORLD_LIMIT = 58.0f;
constexpr float PLAYER_RADIUS = 0.38f;

struct BoxCollider { float x, z, halfX, halfZ; };
constexpr std::array<BoxCollider, 5> STATION_COLLIDERS{{
    {0.0f, 35.0f, 6.5f, 0.35f}, {-6.5f, 31.0f, 0.35f, 4.0f},
    {6.5f, 31.0f, 0.35f, 4.0f}, {-3.8f, 27.0f, 2.7f, 0.35f},
    {3.8f, 27.0f, 2.7f, 0.35f}
}};

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
    int berries = 0;
    int cookedBerries = 0;
    float health = 100.0f;
    float hunger = 100.0f;
    float thirst = 100.0f;
    float stamina = 100.0f;
    bool campfirePlaced = false;
    Vector3 campfirePosition{0.0f, 0.0f, 0.0f};
};

float DistanceXZ(Vector3 a, Vector3 b) {
    const float dx = a.x - b.x;
    const float dz = a.z - b.z;
    return std::sqrt(dx * dx + dz * dz);
}

void DrawTree(float x, float z, float scale) {
    // Layered forest floor shadow keeps trees visually grounded in the scene.
    DrawCylinder({x, 0.018f, z}, 1.45f * scale, 1.65f * scale, 0.025f,
                 12, Fade(Color{25, 31, 25, 255}, 0.34f));

    const float trunkHeight = 3.35f * scale;
    const Vector3 trunkBase{x, 0.08f, z};
    const Vector3 trunkTop{x + 0.10f * scale, trunkHeight, z - 0.06f * scale};
    DrawCylinderEx(trunkBase, trunkTop, 0.25f * scale, 0.13f * scale, 9,
                   Color{76, 59, 43, 255});

    // Exposed branches break the old repeated-cone silhouette.
    DrawCylinderEx({x, 1.75f * scale, z}, {x - 1.05f * scale, 3.15f * scale, z + 0.18f * scale},
                   0.105f * scale, 0.045f * scale, 7, Color{79, 61, 45, 255});
    DrawCylinderEx({x + 0.02f * scale, 2.15f * scale, z}, {x + 0.92f * scale, 3.55f * scale, z - 0.12f * scale},
                   0.09f * scale, 0.035f * scale, 7, Color{82, 63, 46, 255});
    DrawCylinderEx({x, 2.55f * scale, z}, {x - 0.62f * scale, 4.05f * scale, z - 0.55f * scale},
                   0.07f * scale, 0.025f * scale, 6, Color{82, 63, 46, 255});

    // Overlapping irregular crowns create a fuller broadleaf canopy.
    const Color deep{35, 57, 43, 255};
    const Color mid{48, 72, 51, 255};
    const Color light{66, 87, 57, 255};
    DrawSphereEx({x, 3.35f * scale, z}, 1.22f * scale, 9, 9, deep);
    DrawSphereEx({x - 0.66f * scale, 3.72f * scale, z + 0.12f * scale}, 0.91f * scale, 8, 8, mid);
    DrawSphereEx({x + 0.70f * scale, 3.78f * scale, z - 0.10f * scale}, 0.94f * scale, 8, 8, deep);
    DrawSphereEx({x - 0.20f * scale, 4.36f * scale, z - 0.12f * scale}, 0.98f * scale, 9, 9, mid);
    DrawSphereEx({x + 0.25f * scale, 4.88f * scale, z + 0.08f * scale}, 0.72f * scale, 8, 8, light);
}

void DrawRock(Vector3 p, float scale, Color tint) {
    DrawCylinder({p.x, p.y + 0.012f, p.z}, 0.72f * scale, 0.88f * scale,
                 0.02f, 10, Fade(Color{24, 28, 25, 255}, 0.28f));
    DrawSphereEx({p.x, p.y + 0.24f * scale, p.z}, 0.55f * scale, 8, 8, tint);
    DrawSphereEx({p.x + 0.30f * scale, p.y + 0.16f * scale, p.z - 0.12f * scale},
                 0.36f * scale, 7, 7, Color{tint.r, tint.g, tint.b, 255});
    DrawSphereEx({p.x - 0.25f * scale, p.y + 0.12f * scale, p.z + 0.18f * scale},
                 0.25f * scale, 7, 7, Color{static_cast<unsigned char>(std::min(255, tint.r + 13)),
                 static_cast<unsigned char>(std::min(255, tint.g + 13)),
                 static_cast<unsigned char>(std::min(255, tint.b + 13)), 255});
}

Texture2D MakeNoiseTexture(Color tint, float scale, int offsetX, int offsetY) {
    Image image = GenImagePerlinNoise(256, 256, offsetX, offsetY, scale);
    ImageColorTint(&image, tint);
    Texture2D texture = LoadTextureFromImage(image);
    UnloadImage(image);
    SetTextureWrap(texture, TEXTURE_WRAP_REPEAT);
    SetTextureFilter(texture, TEXTURE_FILTER_BILINEAR);
    return texture;
}

Mesh MakeTiledPlane(float width, float length, float repeatX, float repeatY) {
    Mesh mesh = GenMeshPlane(width, length, 1, 1);
    for (int i = 0; i < mesh.vertexCount * 2; ++i) mesh.texcoords[i] *= (i % 2 == 0) ? repeatX : repeatY;
    UpdateMeshBuffer(mesh, 1, mesh.texcoords, mesh.vertexCount * 2 * static_cast<int>(sizeof(float)), 0);
    return mesh;
}

void DrawStationTexturedCube(Texture2D texture, Vector3 p, float w, float h, float d, Color tint) {
    const float x0 = p.x - w*0.5f, x1 = p.x + w*0.5f;
    const float y0 = p.y - h*0.5f, y1 = p.y + h*0.5f;
    const float z0 = p.z - d*0.5f, z1 = p.z + d*0.5f;
    rlSetTexture(texture.id);
    rlBegin(RL_QUADS);
    rlColor4ub(tint.r, tint.g, tint.b, tint.a);
    // Front and back
    rlNormal3f(0, 0, 1);
    rlTexCoord2f(0, 1); rlVertex3f(x0,y0,z1); rlTexCoord2f(1, 1); rlVertex3f(x1,y0,z1);
    rlTexCoord2f(1, 0); rlVertex3f(x1,y1,z1); rlTexCoord2f(0, 0); rlVertex3f(x0,y1,z1);
    rlNormal3f(0, 0, -1);
    rlTexCoord2f(0, 1); rlVertex3f(x1,y0,z0); rlTexCoord2f(1, 1); rlVertex3f(x0,y0,z0);
    rlTexCoord2f(1, 0); rlVertex3f(x0,y1,z0); rlTexCoord2f(0, 0); rlVertex3f(x1,y1,z0);
    // Left and right
    rlNormal3f(-1, 0, 0);
    rlTexCoord2f(0, 1); rlVertex3f(x0,y0,z0); rlTexCoord2f(1, 1); rlVertex3f(x0,y0,z1);
    rlTexCoord2f(1, 0); rlVertex3f(x0,y1,z1); rlTexCoord2f(0, 0); rlVertex3f(x0,y1,z0);
    rlNormal3f(1, 0, 0);
    rlTexCoord2f(0, 1); rlVertex3f(x1,y0,z1); rlTexCoord2f(1, 1); rlVertex3f(x1,y0,z0);
    rlTexCoord2f(1, 0); rlVertex3f(x1,y1,z0); rlTexCoord2f(0, 0); rlVertex3f(x1,y1,z1);
    // Top and bottom
    rlNormal3f(0, 1, 0);
    rlTexCoord2f(0, 1); rlVertex3f(x0,y1,z1); rlTexCoord2f(1, 1); rlVertex3f(x1,y1,z1);
    rlTexCoord2f(1, 0); rlVertex3f(x1,y1,z0); rlTexCoord2f(0, 0); rlVertex3f(x0,y1,z0);
    rlNormal3f(0, -1, 0);
    rlTexCoord2f(0, 1); rlVertex3f(x0,y0,z0); rlTexCoord2f(1, 1); rlVertex3f(x1,y0,z0);
    rlTexCoord2f(1, 0); rlVertex3f(x1,y0,z1); rlTexCoord2f(0, 0); rlVertex3f(x0,y0,z1);
    rlEnd();
    rlSetTexture(0);
}

void DrawWorld(Texture2D concreteTexture, Mesh terrainMesh, Material terrainMaterial, Mesh roadMesh, Material roadMaterial) {
    // Muted overcast sky and layered distant ridges.
    for (int i = 0; i < 11; ++i) {
        const float x = -62.0f + static_cast<float>(i) * 12.4f;
        const float h = 12.0f + static_cast<float>((i * 7) % 6) * 2.1f;
        DrawCube({x, h * 0.42f, 73.0f}, 16.0f, h, 24.0f,
                 Color{76, 91, 86, 255});
        DrawCube({x + 3.0f, h * 0.37f, -79.0f}, 19.0f, h * 0.75f, 25.0f,
                 Color{89, 101, 95, 255});
    }

    DrawMesh(terrainMesh, terrainMaterial, MatrixTranslate(0.0f, 0.0f, 0.0f));

    // Repeating gravel surface keeps detail visible instead of stretching one flat color.
    DrawMesh(roadMesh, roadMaterial, MatrixTranslate(0.0f, 0.035f, 8.0f));
    DrawCube({-2.85f, 0.025f, 8.0f}, 0.42f, 0.035f, 104.0f, Color{62, 65, 55, 255});
    DrawCube({2.85f, 0.025f, 8.0f}, 0.42f, 0.035f, 104.0f, Color{62, 65, 55, 255});
    for (int i = -12; i <= 12; ++i) {
        const float z = static_cast<float>(i) * 4.0f;
        DrawCube({static_cast<float>((i * 7) % 5) * 0.31f, 0.045f, z},
                 0.10f, 0.018f, 0.42f, Color{137, 127, 105, 255});
    }

    // Forest edge. Tree placement is deterministic so collision and visuals match.
    for (int x = -6; x <= 6; ++x) {
        for (int z = -6; z <= 6; ++z) {
            if (std::abs(x) <= 1 || (z >= -2 && z <= 1 && x >= -3 && x <= 3)) continue;
            const float px = static_cast<float>(x) * 8.6f + static_cast<float>((x * 13 + z * 5) % 3);
            const float pz = static_cast<float>(z) * 8.6f + static_cast<float>((z * 11 + x * 3) % 3);
            const float scale = 0.82f + static_cast<float>((x * x + z * z) % 4) * 0.10f;
            DrawTree(px, pz, scale);
        }
    }

    // Brush, fallen timber and stones break up the empty terrain.
    for (int i = 0; i < 34; ++i) {
        const float x = static_cast<float>((i * 17) % 91 - 45);
        const float z = static_cast<float>((i * 29) % 103 - 51);
        if (std::abs(x) < 4.0f) continue;
        DrawRock({x, 0.0f, z}, 0.45f + static_cast<float>(i % 4) * 0.18f,
                 Color{91, 91, 81, 255});
        if (i % 3 == 0) {
            DrawCylinder({x + 1.1f, 0.19f, z + 0.5f}, 0.13f, 0.11f, 2.2f,
                         7, Color{78, 61, 45, 255});
        }
    }

    // Meteorological Station 04: separate wall sections leave a real doorway.
    DrawCube({0.0f, 0.12f, 31.0f}, 13.0f, 0.24f, 8.0f, Color{70, 72, 66, 255});
    DrawStationTexturedCube(concreteTexture, {0.0f, 2.15f, 35.0f}, 13.0f, 4.3f, 0.35f, WHITE);
    DrawStationTexturedCube(concreteTexture, {-6.5f, 2.15f, 31.0f}, 0.35f, 4.3f, 8.0f, WHITE);
    DrawStationTexturedCube(concreteTexture, {6.5f, 2.15f, 31.0f}, 0.35f, 4.3f, 8.0f, WHITE);
    DrawStationTexturedCube(concreteTexture, {-3.8f, 2.15f, 27.0f}, 5.4f, 4.3f, 0.35f, WHITE);
    DrawStationTexturedCube(concreteTexture, {3.8f, 2.15f, 27.0f}, 5.4f, 4.3f, 0.35f, WHITE);
    DrawCube({0.0f, 4.35f, 31.0f}, 13.8f, 0.35f, 8.7f, Color{43, 49, 48, 255});
    DrawCube({0.0f, 4.12f, 31.0f}, 13.2f, 0.12f, 8.2f, Color{76, 78, 70, 255});

    // Windows, metal frames and warning markings.
    for (float x : {-4.7f, 4.7f}) {
        DrawCube({x, 2.45f, 26.79f}, 1.65f, 1.25f, 0.035f, Color{37, 55, 59, 255});
        DrawCube({x, 2.45f, 26.75f}, 1.48f, 1.08f, 0.025f, Color{77, 111, 116, 255});
        DrawCube({x, 2.45f, 26.72f}, 0.055f, 1.18f, 0.045f, Color{64, 69, 66, 255});
        DrawCube({x, 2.45f, 26.72f}, 1.55f, 0.055f, 0.045f, Color{64, 69, 66, 255});
    }
    DrawCube({0.0f, 1.45f, 27.16f}, 1.7f, 2.8f, 0.12f, Color{30, 35, 33, 255});
    DrawCube({-4.8f, 5.0f, 31.0f}, 0.22f, 1.45f, 0.22f, Color{66, 72, 69, 255});
    DrawCylinder({-4.8f, 5.9f, 31.0f}, 0.0f, 0.65f, 0.55f, 10, Color{133, 139, 130, 255});
    DrawCube({0.0f, 3.45f, 26.72f}, 2.3f, 0.42f, 0.08f, Color{142, 111, 61, 255});

    // Antenna, cables and equipment silhouettes on the roof.
    DrawCylinder({4.7f, 5.25f, 32.0f}, 0.06f, 0.06f, 2.0f, 7, Color{61, 68, 66, 255});
    DrawCylinder({4.7f, 6.25f, 32.0f}, 0.0f, 0.48f, 0.52f, 8, Color{118, 124, 115, 255});

    // Pond with rocky bank.
    DrawCylinder({-24.0f, 0.025f, 23.0f}, 7.2f, 7.2f, 0.05f, 40,
                 Color{48, 77, 83, 255});
    for (int i = 0; i < 18; ++i) {
        const float a = static_cast<float>(i) * 6.2831853f / 18.0f;
        DrawRock({-24.0f + std::cos(a) * 7.5f, 0.0f, 23.0f + std::sin(a) * 7.5f},
                 0.55f + static_cast<float>(i % 3) * 0.16f, Color{92, 92, 79, 255});
    }
}
void SaveGame(const Player& player, const std::array<Pickup, 8>& pickups) {
    std::ofstream file("afterlight_save.txt", std::ios::trunc);
    if (!file) return;
    file << "AFTERLIGHT3\n"
         << player.position.x << ' ' << player.position.y << ' ' << player.position.z << ' '
         << player.yaw << ' ' << player.pitch << ' '
         << player.wood << ' ' << player.stone << ' ' << player.berries << ' ' << player.cookedBerries << ' '
         << player.health << ' ' << player.hunger << ' ' << player.thirst << ' ' << player.stamina << ' '
         << (player.campfirePlaced ? 1 : 0) << ' '
         << player.campfirePosition.x << ' ' << player.campfirePosition.y << ' '
         << player.campfirePosition.z << '\n';
    for (const auto& pickup : pickups) file << (pickup.active ? 1 : 0) << ' ';
}

void LoadGame(Player& player, std::array<Pickup, 8>& pickups) {
    std::ifstream file("afterlight_save.txt");
    if (!file) return;

    std::string version;
    file >> version;
    const bool legacySave = version == "AFTERLIGHT2";
    if (!legacySave && version != "AFTERLIGHT3") return;

    Player loaded;
    int campfire = 0;
    if (legacySave) {
        file >> loaded.position.x >> loaded.position.y >> loaded.position.z
             >> loaded.yaw >> loaded.wood >> loaded.stone >> loaded.berries
             >> loaded.health >> loaded.hunger >> loaded.thirst >> loaded.stamina
             >> campfire >> loaded.campfirePosition.x >> loaded.campfirePosition.y
             >> loaded.campfirePosition.z;
    } else {
        file >> loaded.position.x >> loaded.position.y >> loaded.position.z
             >> loaded.yaw >> loaded.pitch
             >> loaded.wood >> loaded.stone >> loaded.berries >> loaded.cookedBerries
             >> loaded.health >> loaded.hunger >> loaded.thirst >> loaded.stamina
             >> campfire >> loaded.campfirePosition.x >> loaded.campfirePosition.y
             >> loaded.campfirePosition.z;
    }
    if (!file) return;

    const auto finite = [](float value) { return std::isfinite(value); };
    if (!finite(loaded.position.x) || !finite(loaded.position.z) ||
        !finite(loaded.yaw) || !finite(loaded.pitch) ||
        !finite(loaded.health) || !finite(loaded.hunger) ||
        !finite(loaded.thirst) || !finite(loaded.stamina) ||
        !finite(loaded.campfirePosition.x) || !finite(loaded.campfirePosition.y) ||
        !finite(loaded.campfirePosition.z) ||
        std::abs(loaded.position.x) > WORLD_LIMIT || std::abs(loaded.position.z) > WORLD_LIMIT ||
        loaded.pitch < -1.35f || loaded.pitch > 1.35f ||
        loaded.wood < 0 || loaded.wood > 999 ||
        loaded.stone < 0 || loaded.stone > 999 ||
        loaded.berries < 0 || loaded.berries > 999 ||
        loaded.cookedBerries < 0 || loaded.cookedBerries > 999 ||
        loaded.health < 0.0f || loaded.health > 100.0f ||
        loaded.hunger < 0.0f || loaded.hunger > 100.0f ||
        loaded.thirst < 0.0f || loaded.thirst > 100.0f ||
        loaded.stamina < 0.0f || loaded.stamina > 100.0f ||
        (campfire != 0 && campfire != 1) ||
        std::abs(loaded.campfirePosition.x) > WORLD_LIMIT ||
        std::abs(loaded.campfirePosition.z) > WORLD_LIMIT) return;

    std::array<bool, 8> activePickups{};
    for (auto& active : activePickups) {
        int value = 0;
        if (!(file >> value) || (value != 0 && value != 1)) return;
        active = value != 0;
    }

    loaded.campfirePlaced = campfire != 0;
    loaded.position.y = 1.8f;
    loaded.verticalVelocity = 0.0f;
    loaded.grounded = true;
    player = loaded;
    for (std::size_t i = 0; i < pickups.size(); ++i)
        pickups[i].active = activePickups[i];
}

} // namespace

int main() {
    SetConfigFlags(FLAG_MSAA_4X_HINT);
    InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "AFTERLIGHT");
    SetTargetFPS(30);
    SetExitKey(KEY_NULL);

    // Lightweight procedural materials; no external asset packs required.
    Texture2D terrainTexture = MakeNoiseTexture(Color{118, 119, 91, 255}, 0.075f, 11, 7);
    Texture2D gravelTexture = MakeNoiseTexture(Color{137, 128, 109, 255}, 0.16f, 29, 13);
    Texture2D concreteTexture = MakeNoiseTexture(Color{126, 130, 120, 255}, 0.11f, 43, 19);
    Mesh terrainMesh = MakeTiledPlane(150.0f, 150.0f, 24.0f, 24.0f);
    Mesh roadMesh = MakeTiledPlane(4.4f, 104.0f, 3.0f, 72.0f);
    Material terrainMaterial = LoadMaterialDefault();
    terrainMaterial.maps[MATERIAL_MAP_DIFFUSE].texture = terrainTexture;
    Material roadMaterial = LoadMaterialDefault();
    roadMaterial.maps[MATERIAL_MAP_DIFFUSE].texture = gravelTexture;
    DisableCursor();

    Player player;
    std::array<Pickup, 8> pickups{{
        {{-8.0f, 0.55f, -9.0f}, true, 0},
        {{11.0f, 0.55f, -5.0f}, true, 0},
        {{-13.0f, 0.55f, 7.0f}, true, 1},
        {{9.0f, 0.55f, 17.0f}, true, 1},
        {{-18.0f, 0.42f, -2.0f}, true, 2},
        {{-29.0f, 0.42f, 16.0f}, true, 2},
        {{16.0f, 0.55f, 10.0f}, true, 0},
        {{-6.0f, 0.55f, 22.0f}, true, 1}
    }};
    LoadGame(player, pickups);

    bool showHelp = true;
    bool showInventory = false;
    float dayTime = 0.28f;
    float weatherClock = 0.0f;
    bool raining = false;
    std::array<Vector3, 96> rainDrops{};
    for (std::size_t i = 0; i < rainDrops.size(); ++i) {
        rainDrops[i] = {
            static_cast<float>(static_cast<int>((i * 37) % 120) - 60),
            2.0f + static_cast<float>((i * 19) % 35),
            static_cast<float>(static_cast<int>((i * 53) % 120) - 60)
        };
    }
    float messageTimer = 0.0f;
    const char* statusMessage = "";

    while (!WindowShouldClose()) {
        const float dt = std::min(GetFrameTime(), 0.05f);
        dayTime += dt * 0.0018f;
        if (dayTime >= 1.0f) dayTime -= 1.0f;
        weatherClock += dt;
        if (weatherClock >= 85.0f) {
            weatherClock = 0.0f;
            raining = !raining;
        }
        if (raining) {
            for (auto& drop : rainDrops) {
                drop.y -= 19.0f * dt;
                drop.x += 1.1f * dt;
                if (drop.y < 0.0f) {
                    drop.y = 22.0f + static_cast<float>((static_cast<int>(drop.x * 7.0f) % 9 + 9) % 9);
                    drop.x = player.position.x + static_cast<float>((static_cast<int>(drop.z * 5.0f) % 31 + 31) % 31) - 15.0f;
                    drop.z = player.position.z + static_cast<float>((static_cast<int>(drop.x * 3.0f) % 31 + 31) % 31) - 15.0f;
                }
            }
        }
        const Vector2 mouse = GetMouseDelta();
        player.yaw -= mouse.x * 0.0025f;
        player.pitch = std::clamp(player.pitch - mouse.y * 0.0022f, -1.35f, 1.35f);

        const Vector3 forward{std::sin(player.yaw), 0.0f, std::cos(player.yaw)};
        // At yaw 0 the camera faces +Z, so screen-right is +X (D), not -X (A).\n        const Vector3 right{std::cosf(player.yaw), 0.0f, -std::sinf(player.yaw)};
        Vector3 movement{0.0f, 0.0f, 0.0f};
        if (IsKeyDown(KEY_W)) { movement.x += forward.x; movement.z += forward.z; }
        if (IsKeyDown(KEY_S)) { movement.x -= forward.x; movement.z -= forward.z; }
        if (IsKeyDown(KEY_D)) { movement.x += right.x; movement.z += right.z; }
        if (IsKeyDown(KEY_A)) { movement.x -= right.x; movement.z -= right.z; }

        const float movementLength = std::sqrt(movement.x * movement.x + movement.z * movement.z);
        if (movementLength > 0.001f) {
            const bool sprinting = IsKeyDown(KEY_LEFT_SHIFT) && player.stamina > 1.0f;
            const float speed = sprinting ? 6.2f : 3.8f;
            if (sprinting) player.stamina = std::max(0.0f, player.stamina - 27.0f * dt);
            const float stepX = movement.x / movementLength * speed * dt;
            const float stepZ = movement.z / movementLength * speed * dt;
            auto blocked = [&](float x, float z) {
                for (const auto& box : STATION_COLLIDERS) {
                    if (std::abs(x - box.x) < box.halfX + PLAYER_RADIUS &&
                        std::abs(z - box.z) < box.halfZ + PLAYER_RADIUS) return true;
                }
                for (int tx = -6; tx <= 6; ++tx) {
                    for (int tz = -6; tz <= 6; ++tz) {
                        if (std::abs(tx) <= 1 || (tz >= -2 && tz <= 1 && tx >= -3 && tx <= 3)) continue;
                        const float treeX = static_cast<float>(tx) * 8.6f + static_cast<float>((tx * 13 + tz * 5) % 3);
                        const float treeZ = static_cast<float>(tz) * 8.6f + static_cast<float>((tz * 11 + tx * 3) % 3);
                        const float dx = x - treeX;
                        const float dz = z - treeZ;
                        if (dx * dx + dz * dz < 0.62f * 0.62f) return true;
                    }
                }
                return false;
            };
            // Resolve axes separately to allow sliding along walls.
            if (!blocked(player.position.x + stepX, player.position.z)) player.position.x += stepX;
            if (!blocked(player.position.x, player.position.z + stepZ)) player.position.z += stepZ;
        }

        if (!IsKeyDown(KEY_LEFT_SHIFT) || movementLength < 0.001f)
            player.stamina = std::min(100.0f, player.stamina + 19.0f * dt);
        player.hunger = std::max(0.0f, player.hunger - 0.035f * dt);
        player.thirst = std::max(0.0f, player.thirst - (raining ? 0.045f : 0.065f) * dt);
        if (player.hunger <= 0.0f || player.thirst <= 0.0f)
            player.health = std::max(0.0f, player.health - 2.0f * dt);
        if (player.campfirePlaced && DistanceXZ(player.position, player.campfirePosition) < 4.0f)
            player.health = std::min(100.0f, player.health + 0.7f * dt);

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

        if (IsKeyPressed(KEY_E)) {
            const bool nearCampfire = player.campfirePlaced &&
                DistanceXZ(player.position, player.campfirePosition) < 2.6f;
            if (nearCampfire && player.berries > 0) {
                --player.berries;
                ++player.cookedBerries;
                statusMessage = "Berries cooked at campfire";
                messageTimer = 2.0f;
                SaveGame(player, pickups);
            } else if (nearestPickup >= 0) {
                auto& pickup = pickups[static_cast<std::size_t>(nearestPickup)];
                pickup.active = false;
                if (pickup.type == 0) ++player.wood;
                else if (pickup.type == 1) ++player.stone;
                else ++player.berries;
                statusMessage = pickup.type == 2 ? "Wild berries collected" : "Resource collected";
                messageTimer = 2.0f;
                SaveGame(player, pickups);
            } else if (nearCampfire) {
                statusMessage = "Collect wild berries before cooking";
                messageTimer = 2.0f;
            }
        }

        if (IsKeyPressed(KEY_I)) showInventory = !showInventory;
        if (IsKeyPressed(KEY_ONE) && player.berries > 0) {
            --player.berries;
            player.hunger = std::min(100.0f, player.hunger + 24.0f);
            statusMessage = "Wild berries eaten";
            messageTimer = 2.0f;
            SaveGame(player, pickups);
        }
        if (IsKeyPressed(KEY_TWO) && player.cookedBerries > 0) {
            --player.cookedBerries;
            player.hunger = std::min(100.0f, player.hunger + 42.0f);
            player.health = std::min(100.0f, player.health + 4.0f);
            statusMessage = "Cooked berries eaten";
            messageTimer = 2.0f;
            SaveGame(player, pickups);
        }
        if (IsKeyPressed(KEY_F)) {
            if (DistanceXZ(player.position, {-24.0f, 0.0f, 23.0f}) < 10.0f) {
                player.thirst = std::min(100.0f, player.thirst + 38.0f);
                statusMessage = "Fresh water collected";
                messageTimer = 2.0f;
                SaveGame(player, pickups);
            } else if (DistanceXZ(player.position, {0.0f, 0.0f, 31.0f}) < 7.0f) {
                statusMessage = "STATION 04: investigate the abandoned equipment";
                messageTimer = 3.0f;
            }
        }
        if (IsKeyPressed(KEY_C)) {
            if (!player.campfirePlaced && player.wood >= 3 && player.stone >= 2) {
                player.wood -= 3;
                player.stone -= 2;
                player.campfirePlaced = true;
                player.campfirePosition = {
                    player.position.x + std::sin(player.yaw) * 2.0f,
                    0.0f,
                    player.position.z + std::cos(player.yaw) * 2.0f
                };
                statusMessage = "Campfire crafted and placed";
                SaveGame(player, pickups);
            } else if (player.campfirePlaced) {
                statusMessage = "You already have a campfire";
            } else {
                statusMessage = "Campfire needs 3 wood and 2 stone";
            }
            messageTimer = 2.5f;
        }

        if (IsKeyPressed(KEY_F5)) {
            SaveGame(player, pickups);
            statusMessage = "Game saved";
            messageTimer = 2.0f;
        }
        if (IsKeyPressed(KEY_F9)) {
            player = Player{};
            for (auto& pickup : pickups) pickup.active = true;
            dayTime = 0.28f;
            raining = false;
            weatherClock = 0.0f;
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

        const float daylight = std::max(0.0f, std::sinf(dayTime * 6.2831853f));
        const unsigned char skyR = static_cast<unsigned char>(38.0f + daylight * 83.0f);
        const unsigned char skyG = static_cast<unsigned char>(47.0f + daylight * 85.0f);
        const unsigned char skyB = static_cast<unsigned char>(62.0f + daylight * 76.0f);
        BeginDrawing();
        const Color skyTop{static_cast<unsigned char>(skyR * 0.72f), static_cast<unsigned char>(skyG * 0.76f), static_cast<unsigned char>(skyB * 0.84f), 255};
        const Color skyHorizon{static_cast<unsigned char>(skyR * 1.10f), static_cast<unsigned char>(skyG * 1.06f), static_cast<unsigned char>(skyB * 0.94f), 255};
        DrawRectangleGradientV(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, skyTop, skyHorizon);
        BeginMode3D(camera);
        DrawWorld(concreteTexture, terrainMesh, terrainMaterial, roadMesh, roadMaterial);
        const float sunAngle = dayTime * 6.2831853f;
        const Vector3 sunPosition{std::cosf(sunAngle) * 48.0f,
                                  std::max(-4.0f, std::sinf(sunAngle) * 38.0f),
                                  player.position.z + 42.0f};
        if (sunPosition.y > 0.0f) {
            DrawSphere(sunPosition, 3.2f, Color{245, 220, 164, 255});
            DrawSphere(sunPosition, 4.8f, Fade(Color{246, 210, 151, 255}, 0.12f));
        } else {
            const Vector3 moonPosition{-sunPosition.x, 25.0f, player.position.z + 38.0f};
            DrawSphere(moonPosition, 2.1f, Color{187, 199, 205, 255});
        }

        // Low-cost grass detail adds texture and scale to the terrain.
        for (int i = 0; i < 190; ++i) {
            const float gx = static_cast<float>((i * 37) % 116 - 58);
            const float gz = static_cast<float>((i * 61) % 116 - 58);
            if (std::abs(gx) < 3.2f && std::abs(gz) < 53.0f) continue;
            const float height = 0.18f + static_cast<float>(i % 5) * 0.045f;
            const Color grass = (i % 3 == 0) ? Color{91, 104, 66, 255} : Color{69, 88, 59, 255};
            DrawLine3D({gx, 0.03f, gz}, {gx - 0.08f, height, gz + 0.02f}, grass);
            DrawLine3D({gx, 0.03f, gz}, {gx + 0.07f, height * 0.82f, gz - 0.04f}, grass);
        }

        for (const auto& drop : rainDrops) {
            if (raining) {
                const Vector3 a{drop.x, drop.y, drop.z};
                const Vector3 b{drop.x - 0.08f, drop.y - 0.9f, drop.z + 0.04f};
                DrawLine3D(a, b, Color{151, 174, 183, 150});
            }
        }
        if (player.campfirePlaced) {
            DrawCylinder({player.campfirePosition.x, 0.18f, player.campfirePosition.z},
                         0.55f, 0.55f, 0.36f, 8, Color{67, 55, 45, 255});
            DrawSphere({player.campfirePosition.x, 0.55f, player.campfirePosition.z},
                       0.30f, Color{235, 112, 49, 230});
            DrawSphere({player.campfirePosition.x, 0.82f, player.campfirePosition.z},
                       0.17f, Color{255, 194, 91, 220});
        }

        for (const auto& pickup : pickups) {
            if (!pickup.active) continue;
            if (pickup.type == 2) {
                DrawSphere(pickup.position, 0.24f, Color{145, 48, 53, 255});
                DrawSphere({pickup.position.x + 0.12f, pickup.position.y + 0.12f, pickup.position.z},
                           0.12f, Color{72, 105, 58, 255});
            } else if (pickup.type == 0) {
                DrawCylinder(pickup.position, 0.16f, 0.13f, 1.15f, 7, Color{103, 75, 49, 255});
                DrawCylinder({pickup.position.x, pickup.position.y, pickup.position.z}, 0.14f, 0.14f, 0.035f, 7, Color{177, 139, 94, 255});
            } else {
                DrawRock(pickup.position, 0.72f, Color{133, 143, 149, 255});
            }
        }

        EndMode3D();

        DrawRectangle(18, 18, 286, 112, Fade(Color{14, 20, 20, 255}, 0.82f));
        DrawText("AFTERLIGHT", 32, 27, 23, RAYWHITE);
        DrawText(TextFormat("W %02i  S %02i  B %02i  COOKED %02i",
                 player.wood, player.stone, player.berries, player.cookedBerries),
                 32, 58, 14, Color{218, 207, 184, 255});
        const auto drawBar = [](int x, int y, const char* label, float value, Color color) {
            DrawText(label, x, y - 1, 12, RAYWHITE);
            DrawRectangle(x + 62, y, 126, 9, Color{43, 49, 47, 255});
            DrawRectangle(x + 62, y, static_cast<int>(126.0f * value / 100.0f), 9, color);
        };
        drawBar(32, 83, "HP", player.health, Color{166, 75, 67, 255});
        drawBar(32, 98, "FOOD", player.hunger, Color{190, 151, 83, 255});
        drawBar(32, 113, "WATER", player.thirst, Color{83, 147, 173, 255});
        DrawText(TextFormat("STAMINA %i%%", static_cast<int>(player.stamina)), 208, 84, 12, RAYWHITE);
        DrawText(raining ? "RAIN" : "DRY", 208, 101, 12, Color{183, 197, 193, 255});
        DrawText(daylight > 0.25f ? "DAY" : "NIGHT", 208, 116, 12, Color{225, 214, 180, 255});

        DrawLine(SCREEN_WIDTH / 2 - 8, SCREEN_HEIGHT / 2, SCREEN_WIDTH / 2 + 8,
                 SCREEN_HEIGHT / 2, Fade(RAYWHITE, 0.85f));
        DrawLine(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 8, SCREEN_WIDTH / 2,
                 SCREEN_HEIGHT / 2 + 8, Fade(RAYWHITE, 0.85f));

        if (showInventory) {
            DrawRectangle(SCREEN_WIDTH - 292, 72, 270, 224, Fade(Color{12, 18, 18, 255}, 0.90f));
            DrawRectangleLines(SCREEN_WIDTH - 292, 72, 270, 224, Color{111, 128, 117, 255});
            DrawText("FIELD INVENTORY", SCREEN_WIDTH - 270, 88, 19, RAYWHITE);
            DrawText(TextFormat("Wood       %02i", player.wood), SCREEN_WIDTH - 270, 123, 16, Color{211, 177, 128, 255});
            DrawText(TextFormat("Stone      %02i", player.stone), SCREEN_WIDTH - 270, 148, 16, Color{180, 190, 194, 255});
            DrawText(TextFormat("Berries    %02i", player.berries), SCREEN_WIDTH - 270, 173, 16, Color{191, 105, 105, 255});
            DrawText(TextFormat("Cooked     %02i", player.cookedBerries), SCREEN_WIDTH - 270, 198, 16, Color{216, 157, 91, 255});
            DrawText("1 Eat berries   2 Eat cooked food", SCREEN_WIDTH - 270, 231, 12, RAYWHITE);
            DrawText("E Cook at fire   C Craft fire: 3W + 2S", SCREEN_WIDTH - 270, 263, 11, Color{211, 202, 178, 255});
        }

        const bool nearCampfirePrompt = player.campfirePlaced &&
            DistanceXZ(player.position, player.campfirePosition) < 2.6f;
        if (nearestPickup >= 0 || nearCampfirePrompt) {
            const char* prompt = nearCampfirePrompt ? "E  -  COOK WILD BERRIES" : "E  -  PICK UP RESOURCE";
            DrawRectangle(SCREEN_WIDTH / 2 - 128, SCREEN_HEIGHT / 2 + 28, 256, 34,
                          Fade(Color{12, 18, 18, 255}, 0.82f));
            DrawText(prompt, SCREEN_WIDTH / 2 - MeasureText(prompt, 16) / 2,
                     SCREEN_HEIGHT / 2 + 37, 16, RAYWHITE);
        }

        const Vector3 stationDirection{player.position.x, 0.0f, 31.0f - player.position.z};
        const float stationDistance = std::sqrt(stationDirection.x * stationDirection.x +
                                                stationDirection.z * stationDirection.z);
        DrawText(TextFormat("STATION 04  |  %im", static_cast<int>(stationDistance)),
                 SCREEN_WIDTH - 250, 24, 18, Color{228, 224, 203, 255});

        if (showHelp) {
            DrawRectangle(18, SCREEN_HEIGHT - 160, 390, 142, Fade(Color{14, 20, 20, 255}, 0.78f));
            DrawText("WASD Move   SHIFT Sprint   SPACE Jump", 32, SCREEN_HEIGHT - 146, 15, RAYWHITE);
            DrawText("E Collect / cook berries at campfire", 32, SCREEN_HEIGHT - 120, 14, RAYWHITE);
            DrawText("F Water / station   I Inventory   1 / 2 Eat", 32, SCREEN_HEIGHT - 94, 13, RAYWHITE);
            DrawText("C Campfire   F5 Save   F9 New   H Help", 32, SCREEN_HEIGHT - 68, 13, RAYWHITE);
            DrawText("ESC Release mouse", 32, SCREEN_HEIGHT - 42, 12, Color{185, 195, 190, 255});
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
    UnloadMaterial(terrainMaterial);
    UnloadMaterial(roadMaterial);
    UnloadMesh(terrainMesh);
    UnloadMesh(roadMesh);
    UnloadTexture(terrainTexture);
    UnloadTexture(gravelTexture);
    UnloadTexture(concreteTexture);
    CloseWindow();
    return 0;
}
