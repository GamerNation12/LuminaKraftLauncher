#include "Launcher.h"
#include <QDir>
#include <QDebug>

Launcher::Launcher(QObject *parent) : QObject(parent) {
    process = new QProcess(this);
    
    // Connect standard output and error log streams
    connect(process, &QProcess::readyReadStandardOutput, this, &Launcher::onReadyReadStandardOutput);
    connect(process, &QProcess::readyReadStandardError, this, &Launcher::onReadyReadStandardError);
    
    // Connect finished signal
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), 
            this, &Launcher::onFinished);
}

Launcher::~Launcher() {
    if (process->state() == QProcess::Running) {
        process->kill();
    }
}

bool Launcher::launchInstance(const QString &instanceId) {
    // -----------------------------------------------------------------------
    // Boilerplate for launching Minecraft layouts assembly
    // -----------------------------------------------------------------------
    // In a full C++ application, you would:
    // 1. Resolve Instance Dir paths utilizing FileSystem::getInstancesDir()
    // 2. Read instance metadata JSON structures
    // 3. Collect standard `-Djava.class.path` strings (libraries and Natives)
    // 4. Set RAM Args: `-Xmx4G`
    
    qDebug() << "🚀 Launching instance ID:" << instanceId;

    QString javaExecutable = "java"; // In practice, find accurate JDK path
    QStringList arguments;
    
    // Test argument to verify it spawns correctly
    arguments << "-version"; 

    process->setProgram(javaExecutable);
    process->setArguments(arguments);
    
    qDebug() << "📂 Executing Command:" << javaExecutable << arguments.join(" ");
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
