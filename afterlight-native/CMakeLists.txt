cmake_minimum_required(VERSION 3.20)
project(AFTERLIGHT VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_GAMES OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

include(FetchContent)
FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG 5.5
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(raylib)

add_executable(AFTERLIGHT src/main.cpp)
target_link_libraries(AFTERLIGHT PRIVATE raylib)
if(WIN32)
    target_link_libraries(AFTERLIGHT PRIVATE winmm)
endif()

if(MSVC)
    target_compile_options(AFTERLIGHT PRIVATE /W4 /permissive-)
else()
    target_compile_options(AFTERLIGHT PRIVATE -Wall -Wextra -Wpedantic)
endif()

set_target_properties(AFTERLIGHT PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)
