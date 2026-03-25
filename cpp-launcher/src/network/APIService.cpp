#include "APIService.h"
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include <QUrlQuery>
#include <QDebug>

APIService::APIService(QObject *parent) : QObject(parent) {
    manager = new QNetworkAccessManager(this);
}

APIService::~APIService() {}

void APIService::fetchModpacks(const QString &query, int limit) {
    QUrl url("https://api.modrinth.com/v2/search");
    QUrlQuery urlQuery;
    
    urlQuery.addQueryItem("limit", QString::number(limit));
    
    // Default filters for modpacks
    urlQuery.addQueryItem("facets", "[[\"project_type:modpack\"]]");
    
    if (!query.isEmpty()) {
        urlQuery.addQueryItem("query", query);
    }

    url.setQuery(urlQuery);

    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::UserAgentHeader, "LuminaKraftLauncher/0.1.0");

    QNetworkReply *reply = manager->get(request);
    connect(reply, &QNetworkReply::finished, [this, reply]() {
        this->onFinished(reply);
    });
}

void APIService::onFinished(QNetworkReply *reply) {
    reply->deleteLater();

    if (reply->error() != QNetworkReply::NoError) {
        emit loadFailed(reply->errorString());
        return;
    }

    QByteArray data = reply->readAll();
    QJsonDocument doc = QJsonDocument::fromJson(data);

    if (!doc.isNull() && doc.isObject()) {
        QJsonObject root = doc.object();
        QJsonArray hits = root["hits"].toArray();
        
        QList<Modpack> list;
        for (int i = 0; i < hits.size(); ++i) {
            QJsonObject item = hits[i].toObject();
            
            Modpack pack;
            // Map Modrinth JSON to Modpack Struct
            pack.id = item["project_id"].toString();
            pack.name = item["title"].toString();
            pack.description = item["description"].toString();
            pack.shortDescription = item["description"].toString();
            
            // Version setup from search hits is usually approximate
            pack.version = "Latest"; 
            
            // Categories
            QJsonArray cats = item["categories"].toArray();
            for (int c = 0; c < cats.size(); ++c) {
                pack.featureIcons.append(cats[c].toString());
            }
            
            pack.logo = item["icon_url"].toString();
            pack.isModrinth = true;

            list.append(pack);
        }

        qDebug() << "✅ Successfully loaded" << list.size() << "modpacks from Modrinth.";
        emit modpacksLoaded(list);
    } else {
        emit loadFailed("Invalid JSON response received from API.");
    }
}
