#include "FileSystem.h"
#include <QStandardPaths>
#include <QRegularExpression>
#include <QDebug>

QString FileSystem::getLauncherDataDir() {
    QString appData = qgetenv("APPDATA");
    if (appData.isEmpty()) {
        appData = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    }
    
    QDir dir(appData);
    QString target = dir.absoluteFilePath("NebulaLauncher");
    
    ensureDirExists(target);
    return target;
}

QString FileSystem::getInstancesDir() {
    QString dataDir = getLauncherDataDir();
    QDir dir(dataDir);
    QString instancesPath = dir.absoluteFilePath("instances");
    
    ensureDirExists(instancesPath);
    return instancesPath;
}

QString FileSystem::getMetaVersionsDir() {
    QString dataDir = getLauncherDataDir();
    QDir dir(dataDir);
    QString metaVersionsPath = dir.absoluteFilePath("meta/versions");
    
    ensureDirExists(metaVersionsPath);
    return metaVersionsPath;
}

QJsonObject FileSystem::readInstanceJson(const QString &instanceId) {
    QDir instancesDir(getInstancesDir());
    qDebug() << "🔍 instanceId lookup:" << instanceId << "in directory:" << instancesDir.absolutePath();

    QString jsonPath = instancesDir.absoluteFilePath(instanceId + "/instance.json");
    if (!instancesDir.exists(instanceId)) {
        qDebug() << "❌ Failed instancesDir.exists:" << instancesDir.absolutePath() << instanceId;
        return QJsonObject();
    }

    QFile file(jsonPath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qDebug() << "❌ Failed file.open:" << jsonPath;
        return QJsonObject();
    }

    QByteArray data = file.readAll();
    file.close();

    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(data, &error);
    if (error.error != QJsonParseError::NoError || !doc.isObject()) {
        qDebug() << "❌ JSON error:" << error.errorString();
        return QJsonObject();
    }

    return doc.object();
}

QJsonObject FileSystem::readVersionJson(const QString &version) {
    QDir versionsDir(getMetaVersionsDir());
    QString jsonPath = versionsDir.absoluteFilePath(version + "/" + version + ".json");
    qDebug() << "🔍 Native Path Check:" << jsonPath;

    if (!versionsDir.exists(version)) {
        qDebug() << "❌ Version folder does not exist:" << versionsDir.absoluteFilePath(version);
        return QJsonObject();
    }

    QFile file(jsonPath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qDebug() << "❌ Could not open version json:" << jsonPath;
        return QJsonObject();
    }

    QByteArray data = file.readAll();
    file.close();

    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(data, &error);
    if (error.error != QJsonParseError::NoError || !doc.isObject()) {
        qDebug() << "❌ JSON Parse Error:" << error.errorString();
        return QJsonObject();
    }

    return doc.object();
}

QString FileSystem::sanitizeFolderName(const QString &name) {
    QString sanitized = name;
    
    // Replace characters: / \ : * ? " < > | with _
    sanitized.replace(QRegularExpression("[/\\\\:\\*\\?\\\"<>\\|]"), "_");
    
    return sanitized.trimmed();
}

QString FileSystem::generateInstanceFolderName(const QString &modpackName) {
    QString baseName = sanitizeFolderName(modpackName);
    QDir dir(getInstancesDir());
    
    // If the base name doesn't exist, use it directly
    if (!dir.exists(baseName)) {
        return baseName;
    }
    
    // Otherwise, try with (1), (2), (3), etc.
    for (int i = 1; i < 1000; ++i) {
        QString candidateName = QString("%1 (%2)").arg(baseName).arg(i);
        if (!dir.exists(candidateName)) {
            return candidateName;
        }
    }
    
    return baseName; // Fallback
}

bool FileSystem::ensureDirExists(const QString &path) {
    QDir dir(path);
    if (!dir.exists()) {
        if (dir.mkpath(".")) {
            qDebug() << "✅ Created directory:" << path;
            return true;
        } else {
            qDebug() << "❌ Failed to create directory:" << path;
            return false;
        }
    }
    return true;
}
