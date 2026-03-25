#pragma once

#include <QObject>
#include <QTcpServer>
#include <QTcpSocket>

/**
 * @brief Manages a local HTTP server listening for Microsoft/Supabase OAuth callbacks
 */
class LoginManager : public QObject {
    Q_OBJECT
public:
    explicit LoginManager(QObject *parent = nullptr);
    ~LoginManager();

    /**
     * @brief Start listening on a random available port
     * @return The port number, or -1 if starting failed
     */
    int startServer();

    /**
     * @brief Stop the local server
     */
    void stopServer();

signals:
    /**
     * @brief Emitted when tokens are successfully received and parsed
     */
    void loginSuccess(const QString &accessToken, const QString &refreshToken);
    
    void loginFailed(const QString &error);

private slots:
    void onNewConnection();
    void onReadyRead();
    void onSocketDisconnected();

private:
    QTcpServer *server;
};
