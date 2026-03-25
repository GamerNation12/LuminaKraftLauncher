#include "DownloadManager.h"
#include <QDir>
#include <QFileInfo>
#include <QDebug>

DownloadManager::DownloadManager(QObject *parent) : QObject(parent) {
    manager = new QNetworkAccessManager(this);
}

DownloadManager::~DownloadManager() {
    // manager is deleted automatically since list parent is this
}

void DownloadManager::queueDownload(const QString &url, const QString &path, const QString &sha1) {
    queue.append({url, path, sha1});
    totalFiles++;
    emit progressChanged(completedFiles, totalFiles);
}

void DownloadManager::setMaxConcurrentDownloads(int max) {
    if (max > 0) {
        maxConcurrent = max;
    }
}

void DownloadManager::start() {
    // Fill up active download slots up to concurrent limit
    while (activeDownloads < maxConcurrent && !queue.isEmpty()) {
        processNext();
    }
}

void DownloadManager::processNext() {
    if (queue.isEmpty()) return;

    DownloadItem item = queue.takeFirst();
    activeDownloads++;

    QNetworkRequest request(item.url);
    
    // Some endpoints may require User-Agent, etc.
    request.setHeader(QNetworkRequest::UserAgentHeader, "LuminaKraftLauncher/0.1.0");

    QNetworkReply *reply = manager->get(request);
    
    // Store variables on the reply temporarily to fetch later on finish slot
    reply->setProperty("savePath", item.path);
    reply->setProperty("sha1", item.sha1);

    // Connect to single node reply finished slot
    connect(reply, &QNetworkReply::finished, [this, reply]() {
        this->onDownloadFinished(reply);
    });
}

void DownloadManager::onDownloadFinished(QNetworkReply *reply) {
    activeDownloads--;
    completedFiles++;

    QString savePath = reply->property("savePath").toString();
    
    if (reply->error() == QNetworkReply::NoError) {
        QFile file(savePath);
        
        // Ensure parent directory exists
        QDir().mkpath(QFileInfo(file).absolutePath());

        // Write binary data to disk
        if (file.open(QIODevice::WriteOnly)) {
            file.write(reply->readAll());
            file.close();
            qDebug() << "✅ Downloaded:" << savePath;
        } else {
            qDebug() << "❌ Failed to open file for writing:" << savePath;
        }
    } else {
        qDebug() << "❌ Download failed:" << reply->url().toString() << reply->errorString();
    }

    reply->deleteLater();
    emit progressChanged(completedFiles, totalFiles);

    // Fire continuous dispatcher loop for remaining items
    if (!queue.isEmpty()) {
        processNext();
    } else if (activeDownloads == 0) {
        emit finished();
    }
}
