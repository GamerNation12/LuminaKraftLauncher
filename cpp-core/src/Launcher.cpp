#include "Launcher.h"
#include "FileSystem.h"
#include <QDir>
#include <QDebug>
#include <QJsonArray>
#include <QJsonObject>
#include <QJsonDocument>

Launcher::Launcher(QObject *parent) : QObject(parent) {
    process = new QProcess(this);
    
    // Connect standard output and error log streams
    connect(process, &QProcess::readyReadStandardOutput, this, &Launcher::onReadyReadStandardOutput);
    connect(process, &QProcess::readyReadStandardError, this, &Launcher::onReadyReadStandardError);
    
    // Connect finished signal
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), 
            this, &Launcher::onFinished);
            
    // Connect error signal
    connect(process, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
        QString errorMsg;
        switch (error) {
            case QProcess::FailedToStart: errorMsg = "Failed to start (is java in PATH?)"; break;
            case QProcess::Crashed: errorMsg = "Crashed"; break;
            case QProcess::Timedout: errorMsg = "Timed out"; break;
            case QProcess::WriteError: errorMsg = "Write error"; break;
            case QProcess::ReadError: errorMsg = "Read error"; break;
            case QProcess::UnknownError: errorMsg = "Unknown error"; break;
        }
        emit logReceived("[FATAL] Process Error: " + errorMsg);
        qDebug() << "❌ Process Error:" << errorMsg;
    });
}

Launcher::~Launcher() {
    if (process->state() == QProcess::Running) {
        process->kill();
    }
}

bool Launcher::launchInstance(const QString &instanceId, const QJsonObject &auth) {
    qDebug() << "💎 [PROD-ENGINE] Natively Resolving instance ID:" << instanceId;

    QJsonObject instanceMeta = FileSystem::readInstanceJson(instanceId);
    if (instanceMeta.isEmpty()) {
        emit logReceived("[FATAL] Process Error: Failed to read instance.json natively!");
        return false;
    }

    QString mcVersion = instanceMeta["minecraftVersion"].toString();
    QString modloader = instanceMeta["modloader"].toString();
    QString modloaderVersion = instanceMeta["modloaderVersion"].toString();

    QString targetVersionId = mcVersion;
    if (!modloader.isEmpty() && !modloaderVersion.isEmpty()) {
        targetVersionId = mcVersion + "-" + modloaderVersion;
    }

    QJsonObject versionMeta = FileSystem::readVersionJson(targetVersionId);
    if (versionMeta.isEmpty()) {
        emit logReceived("[FATAL] Process Error: Failed to read version.json natively for " + targetVersionId + "!");
        return false;
    }

    // --- Dynamically Build Classpath ---
    QStringList classPathElements;
    QString librariesBase = QDir(FileSystem::getLauncherDataDir()).absoluteFilePath("meta/libraries");
    
    QJsonArray libraries = versionMeta["libraries"].toArray();
    for (const QJsonValue &libVal : libraries) {
        QJsonObject lib = libVal.toObject();
        QJsonObject downloads = lib["downloads"].toObject();
        QJsonObject artifact = downloads["artifact"].toObject();
        if (artifact.contains("path")) {
            QString path = artifact["path"].toString();
            classPathElements << QDir(librariesBase).absoluteFilePath(path);
        }
    }

    // Add main game JAR to classpath
    QString versionBase = QDir(FileSystem::getLauncherDataDir()).absoluteFilePath("meta/versions/" + mcVersion);
    classPathElements << QDir(versionBase).absoluteFilePath(mcVersion + ".jar");

    QString classPathString = classPathElements.join(";"); // Note: Windows uses ';'

    // --- Extract Main Class ---
    QString mainClass = versionMeta["mainClass"].toString();
    if (mainClass.isEmpty()) mainClass = "net.minecraft.client.main.Main";

    // --- Build Arguments ---
    QString javaExecutable = "java"; 
    QStringList arguments;

    // JVM Args
    arguments << "-Xmx4G"; // Default payload injection
    arguments << "-Djava.library.path=" + QDir(FileSystem::getLauncherDataDir()).absoluteFilePath("meta/natives/" + mcVersion);
    arguments << "-cp" << classPathString;
    
    // Main Class Launch
    arguments << mainClass;

    // --- Game Tokens ---
    QString username = auth.contains("username") ? auth["username"].toString() : "PlayerNative";
    QString uuid = auth.contains("uuid") ? auth["uuid"].toString() : "00000000000000000000000000000000";
    QString accessToken = auth.contains("accessToken") ? auth["accessToken"].toString() : "dummy_token";
    uuid.remove("-");

    // Game Args (Simplified injection)
    // In full implementation, we run a regex pass over `arguments.game` array replacing templated tokens
    arguments << "--version" << mcVersion;
    arguments << "--gameDir" << QDir(FileSystem::getInstancesDir()).absoluteFilePath(instanceId);
    arguments << "--assetsDir" << QDir(FileSystem::getLauncherDataDir()).absoluteFilePath("meta/assets");
    arguments << "--assetIndex" << versionMeta["assetIndex"].toObject()["id"].toString();
    arguments << "--username" << username;
    arguments << "--versionType" << "Nebula";
    arguments << "--uuid" << uuid;
    arguments << "--accessToken" << accessToken;

    process->setProgram(javaExecutable);
    process->setArguments(arguments);
    
    qDebug() << "📂 Executing Native Minecraft Pipeline!";
    emit gameStarted();
    
    process->start();
    return true;
}

void Launcher::onReadyReadStandardOutput() {
    while (process->canReadLine()) {
        QString line = QString::fromUtf8(process->readLine()).trimmed();
        emit logReceived(line);
        qDebug() << "🎮 [stdout]" << line;
    }
}

void Launcher::onReadyReadStandardError() {
    QString error = QString::fromUtf8(process->readAllStandardError()).trimmed();
    emit logReceived("[ERROR] " + error);
    qDebug() << "🎮 [stderr]" << error;
}

void Launcher::onFinished(int exitCode, QProcess::ExitStatus status) {
    qDebug() << "🏁 Game process finished with code:" << exitCode;
    emit gameFinished(exitCode);
}
