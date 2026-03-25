#pragma once

#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QList>
#include "../models/Modpack.h"

/**
 * @brief Handles REST API calls to Modrinth/CurseForge
 */
class APIService : public QObject {
    Q_OBJECT
public:
    explicit APIService(QObject *parent = nullptr);
    ~APIService();

    /**
     * @brief Fetch modpacks from Modrinth
     * @param query Search string (optional)
     * @param limit Maximum hits to return
     */
    void fetchModpacks(const QString &query = "", int limit = 20);

signals:
    /**
     * @brief Emitted when modpacks are successfully parsed
     */
    void modpacksLoaded(const QList<Modpack> &modpacks);
    
    void loadFailed(const QString &error);

private slots:
    void onFinished(QNetworkReply *reply);

private:
    QNetworkAccessManager *manager;
};
