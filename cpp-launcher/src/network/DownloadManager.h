#pragma once

#include <QObject>
#include <QString>
#include <QList>
#include <QNetworkAccessManager>
#include <QNetworkReply>

/**
 * @brief Represents a single file download task
 */
struct DownloadItem {
    QString url;
    QString path;
    QString sha1; // Optional checksum for verification
};

/**
 * @brief Manages parallel downloads with active concurrency limits
 */
class DownloadManager : public QObject {
    Q_OBJECT
public:
    explicit DownloadManager(QObject *parent = nullptr);
    ~DownloadManager();

    /**
     * @brief Queue a file for download
     */
    void queueDownload(const QString &url, const QString &path, const QString &sha1 = "");

    /**
     * @brief Start processing the download queue
     */
    void start();

    /**
     * @brief Set maximum number of active concurrent downloads
     */
    void setMaxConcurrentDownloads(int max);

signals:
    /**
     * @brief Emitted when progress updates
     */
    void progressChanged(int completed, int total);

    /**
     * @brief Emitted when ALL queued downloads are finished
     */
    void finished();

private slots:
    void onDownloadFinished(QNetworkReply *reply);

private:
    void processNext();

    QNetworkAccessManager *manager;
    QList<DownloadItem> queue;
    
    int activeDownloads = 0;
    int maxConcurrent = 10; // Default limit
    
    int totalFiles = 0;
    int completedFiles = 0;
};
