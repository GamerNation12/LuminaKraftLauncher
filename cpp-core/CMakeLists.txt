cmake_minimum_required(VERSION 3.16)

project(NebulaCore VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Qt Core and Network (Headless - No Widgets)
find_package(Qt6 REQUIRED COMPONENTS Core Network)

set(CMAKE_AUTOMOC ON)

set(SOURCES
    src/main.cpp
    src/CommandProcessor.cpp
    src/CommandProcessor.h
    src/Launcher.cpp
    src/Launcher.h
    src/FileSystem.cpp
    src/FileSystem.h
    src/network/APIService.cpp
    src/network/APIService.h
    src/network/DownloadManager.cpp
    src/network/DownloadManager.h
    src/network/LoginManager.cpp
    src/network/LoginManager.h
)

add_executable(${PROJECT_NAME} ${SOURCES})

target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Network
)
