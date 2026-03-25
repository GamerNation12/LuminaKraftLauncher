#pragma once

#include <QObject>
#include <QJsonObject>
#include <QJsonDocument>
#include <iostream>
#include "Launcher.h"
#include "network/DownloadManager.h"

class CommandProcessor : public QObject {
    Q_OBJECT
public:
    explicit CommandProcessor(QObject *parent = nullptr);

public slots:
    void processCommand(const QJsonObject& cmd);

private:
    Launcher* m_launcher;
    DownloadManager* m_downloadManager;
    QString m_currentModpackId;
};
