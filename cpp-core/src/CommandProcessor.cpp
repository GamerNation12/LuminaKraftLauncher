#include "CommandProcessor.h"
#include <QCoreApplication>

CommandProcessor::CommandProcessor(QObject *parent) : QObject(parent) {
    m_launcher = new Launcher(this);
    m_downloadManager = new DownloadManager(this);

    // Wire up Launcher Signals
    connect(m_launcher, &Launcher::gameStarted, this, [this]() {
        QJsonObject res;
        res["action"] = "launch";
        res["status"] = "game_started";
        res["modpack_id"] = m_currentModpackId;
        std::cout << QJsonDocument(res).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    });

    connect(m_launcher, &Launcher::gameFinished, this, [this](int exitCode) {
        QJsonObject res;
        res["action"] = "launch";
        res["status"] = "game_finished";
        res["exit_code"] = exitCode;
        res["modpack_id"] = m_currentModpackId;
        std::cout << QJsonDocument(res).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    });

    connect(m_launcher, &Launcher::logReceived, this, [this](const QString &line) {
        QJsonObject res;
        res["action"] = "launch";
        res["status"] = "game_log";
        res["message"] = line;
        res["modpack_id"] = m_currentModpackId;
        std::cout << QJsonDocument(res).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    });

    // Wire up DownloadManager Signals
    connect(m_downloadManager, &DownloadManager::progressChanged, this, [](int completed, int total) {
        QJsonObject res;
        res["action"] = "install";
        res["status"] = "downloading";
        res["completed"] = completed;
        res["total"] = total;
        res["percentage"] = total > 0 ? (completed * 100 / total) : 0;
        std::cout << QJsonDocument(res).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    });

    connect(m_downloadManager, &DownloadManager::finished, this, []() {
        QJsonObject res;
        res["action"] = "install";
        res["status"] = "download_finished";
        std::cout << QJsonDocument(res).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    });
}

void CommandProcessor::processCommand(const QJsonObject& cmd) {
    QString action = cmd["action"].toString();
    
    if (action == "ping") {
        QJsonObject response;
        response["action"] = action;
        response["status"] = "pong";
        std::cout << QJsonDocument(response).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    } else if (action == "launch") {
        QString modpackId = cmd["modpack_id"].toString();
        m_currentModpackId = modpackId;
        QJsonObject auth = cmd["auth"].toObject();
        
        QJsonObject res; 
        res["action"] = "launch"; 
        res["status"] = "launching_native";
        res["modpack_id"] = modpackId;
        std::cout << QJsonDocument(res).toJson(QJsonDocument::Compact).toStdString() << std::endl;
        
        m_launcher->launchInstance(modpackId, auth);
    } else if (action == "install") {
        QString modpackId = cmd["modpack_id"].toString();
        // In full Prism logic, we first resolve the manifest.
        // For testing the C++ pipeline bridging, we instantly spawn multi-threaded downloader.
        m_downloadManager->queueDownload("https://example.com/test1.jar", "test1.jar", "");
        m_downloadManager->queueDownload("https://example.com/test2.jar", "test2.jar", "");
        m_downloadManager->start();
    } else if (action == "exit") {
        QCoreApplication::quit();
    } else {
        QJsonObject response;
        response["action"] = action;
        response["status"] = "error";
        response["message"] = "Unknown action.";
        std::cout << QJsonDocument(response).toJson(QJsonDocument::Compact).toStdString() << std::endl;
    }
}
