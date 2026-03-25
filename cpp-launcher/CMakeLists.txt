cmake_minimum_required(VERSION 3.16)

project(LuminaKraftLauncherCPP VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# Qt Configuration 
# ---------------------------------------------------------------------------
# To build this, you need to install Qt 6 via the Qt Online Installer
# and make sure CMake can find it (e.g., set CMAKE_PREFIX_PATH to your Qt install).
find_package(Qt6 REQUIRED COMPONENTS Widgets Core Network)

# Enable automatic compilation of Qt structures (MOC, UIC, RCC)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# ---------------------------------------------------------------------------
# Source Files
# ---------------------------------------------------------------------------
set(SOURCES
    src/main.cpp
    src/FileSystem.cpp
    src/network/DownloadManager.cpp
    src/Launcher.cpp
    src/ui/MainWindow.cpp
    src/network/LoginManager.cpp
    src/network/APIService.cpp
    src/ui/ModpackDetailView.cpp
)

# ---------------------------------------------------------------------------
# Executable Setup
# ---------------------------------------------------------------------------
add_executable(${PROJECT_NAME} ${SOURCES})

# Link libraries
target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Widgets
    Qt6::Core
    Qt6::Network
)

# Properties for Windows (hides console window)
if(WIN32)
    set_target_properties(${PROJECT_NAME} PROPERTIES WIN32_EXECUTABLE TRUE)
endif()
