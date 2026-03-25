#pragma once

#include <QString>
#include <QStringList>
#include <QList>

/**
 * @brief Represents a collaborator/author of a modpack
 */
struct Collaborator {
    QString name;
    QString logo;
};

/**
 * @brief Represents a Modpack configuration/metadata
 */
struct Modpack {
    QString id;
    QString name;
    QString description;
    QString shortDescription;
    QString version;
    QString minecraftVersion;
    QString modloader;
    QString modloaderVersion;
    QString urlModpackZip;
    QString gamemode;
    
    bool isNew = false;
    bool isActive = false;
    bool isComingSoon = false;
    
    QStringList images;
    QString logo;
    QString bannerUrl;
    QStringList featureIcons;
    
    QList<Collaborator> collaborators;
    
    // Optional/Nullable strings can be empty QStrings
    QString youtubeEmbed;
    QString tiktokEmbed;
    QString ip;
    QString leaderboardPath;
    QString category;
    QString fileSha256;
    
    bool allowCustomMods = true;
    bool allowCustomResourcepacks = true;
    bool isModrinth = false;
};
