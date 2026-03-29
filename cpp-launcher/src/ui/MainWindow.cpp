#include "MainWindow.h"
#include <QUrl>
#include <QDebug>

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    setupUi();
    
    // Initialize our C++ Backend Services
    apiService = new APIService(this);
    launcher = new Launcher(this);

    // Point QWebEngineView directly to the React localhost dev server
    // (In production, this would load the static index.html from dist/)
    qDebug() << "🌐 Loading React Frontend into QWebEngineView...";
    webView->setUrl(QUrl("http://localhost:1420"));
}

MainWindow::~MainWindow() {}

void MainWindow::setupUi() {
    this->resize(1200, 800);
    this->setWindowTitle("Nebula Launcher");
    this->setStyleSheet("QMainWindow { background-color: #020617; }");

    centralWidget = new QWidget(this);
    setCentralWidget(centralWidget);

    mainLayout = new QVBoxLayout(centralWidget);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    // Create the Chromium Engine view
    webView = new QWebEngineView(centralWidget);
    mainLayout->addWidget(webView);
}
