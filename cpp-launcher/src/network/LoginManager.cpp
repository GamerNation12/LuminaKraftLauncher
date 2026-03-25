#include "LoginManager.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QDebug>

LoginManager::LoginManager(QObject *parent) : QObject(parent) {
    server = new QTcpServer(this);
    connect(server, &QTcpServer::newConnection, this, &LoginManager::onNewConnection);
}

LoginManager::~LoginManager() {
    stopServer();
}

int LoginManager::startServer() {
    if (server->listen(QHostAddress::LocalHost, 0)) {
        qDebug() << "🛰️ OAuth Server listening on localhost port:" << server->serverPort();
        return server->serverPort();
    } else {
        qDebug() << "❌ Failed to start OAuth Server:" << server->errorString();
        return -1;
    }
}

void LoginManager::stopServer() {
    if (server->isListening()) {
        server->close();
        qDebug() << "🛑 OAuth Server stopped.";
    }
}

void LoginManager::onNewConnection() {
    QTcpSocket *socket = server->nextPendingConnection();
    connect(socket, &QTcpSocket::readyRead, this, &LoginManager::onReadyRead);
    connect(socket, &QTcpSocket::disconnected, this, &LoginManager::onSocketDisconnected);
}

void LoginManager::onReadyRead() {
    QTcpSocket *socket = qobject_cast<QTcpSocket *>(sender());
    if (!socket) return;

    QByteArray data = socket->readAll();
    QString request = QString::fromUtf8(data);

    // --- Simple HTTP CORS and Router ---
    if (request.startsWith("OPTIONS")) {
        QString response = 
            "HTTP/1.1 200 OK\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: POST, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Content-Type\r\n"
            "Content-Length: 0\r\n"
            "\r\n";
        socket->write(response.toUtf8());
        socket->flush();
        return;
    }

    if (request.startsWith("POST")) {
        // Extract body after header separator \r\n\r\n
        int bodyIndex = request.indexOf("\r\n\r\n");
        if (bodyIndex != -1) {
            QString body = request.mid(bodyIndex + 4).trimmed();
            
            QJsonDocument doc = QJsonDocument::fromJson(body.toUtf8());
            if (!doc.isNull() && doc.isObject()) {
                QJsonObject obj = doc.object();
                QString accessToken = obj["access_token"].toString();
                QString refreshToken = obj["refresh_token"].toString();

                if (!accessToken.isEmpty()) {
                    emit loginSuccess(accessToken, refreshToken);
                    
                    QString response = 
                        "HTTP/1.1 200 OK\r\n"
                        "Content-Type: text/plain\r\n"
                        "Access-Control-Allow-Origin: *\r\n"
                        "\r\n"
                        "Authentication successful! You can safely close this window.";
                    socket->write(response.toUtf8());
                    socket->flush();
                    
                    stopServer(); // Auto-shutdown after receiving tokens
                    return;
                }
            }
        }
    }

    // Fallback Bad Request
    QString response = "HTTP/1.1 400 Bad Request\r\n\r\n";
    socket->write(response.toUtf8());
    socket->flush();
}

void LoginManager::onSocketDisconnected() {
    QTcpSocket *socket = qobject_cast<QTcpSocket *>(sender());
    if (socket) {
        socket->deleteLater();
    }
}
