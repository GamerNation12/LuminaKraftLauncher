#pragma once

#include <QString>

/**
 * @brief Represents an installed instance configuration
 */
struct InstanceMetadata {
    QString id;
    QString name;
    QString version;
    QString installedAt;
    QString modloader;
    QString modloaderVersion;
    QString minecraftVersion;
    
    // Optional/Nullable Rams (Rust Options mapped to defaults or -1)
    int recommendedRam = -1; // Recommended RAM in MB
    QString ramAllocation = "global"; // "curseforge" | "recommended" | "custom" | "global"
    int customRam = -1; // Custom RAM in MB
    
    QString category;
    bool allowCustomMods = true;
};
