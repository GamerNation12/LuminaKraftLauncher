#include "MainWindow.h"
#include <QLabel>
#include <QFrame>
#include <QStyle>
#include <QApplication>

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    setupUi();
    applyStyles();

    // Initialize API Service
    apiService = new APIService(this);
    connect(apiService, &APIService::modpacksLoaded, this, &MainWindow::onModpacksLoaded);
    connect(apiService, &APIService::loadFailed, this, &MainWindow::onLoadFailed);

    // Initialize Launcher
    launcher = new Launcher(this);
    connect(detailView, &ModpackDetailView::playRequested, this, [this](const QString &id) {
        qDebug() << "▶️ Play requested for:" << id;
        launcher->launchInstance(id);
    });

    // Fetch initial grid
    apiService->fetchModpacks();
}

MainWindow::~MainWindow() {}

void MainWindow::setupUi() {
    centralWidget = new QWidget(this);
    setCentralWidget(centralWidget);

    mainLayout = new QHBoxLayout(centralWidget);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    // 1. Sidebar Setup
    sidebar = new QWidget(centralWidget);
    sidebar->setObjectName("sidebar");
    sidebar->setFixedWidth(240);
    sidebarLayout = new QVBoxLayout(sidebar);
    sidebarLayout->setContentsMargins(15, 30, 15, 30);
    sidebarLayout->setSpacing(10);

    QLabel *logoLabel = new QLabel("LuminaKraft", sidebar);
    logoLabel->setStyleSheet("font-size: 20px; font-weight: bold; color: #60A5FA;");
    sidebarLayout->addWidget(logoLabel);
    sidebarLayout->addSpacing(20);

    QStringList navItems = {"Dashboard", "Modpacks", "Worlds", "Logs", "Settings"};
    for (const QString &nav : navItems) {
        QPushButton *btn = new QPushButton(nav, sidebar);
        btn->setCursor(Qt::PointingHandCursor);
        sidebarLayout->addWidget(btn);
    }

    sidebarLayout->addStretch(); // Push to bottom

    // 2. Content Area Setup
    contentArea = new QWidget(centralWidget);
    contentArea->setObjectName("contentArea");
    contentLayout = new QVBoxLayout(contentArea);
    contentLayout->setContentsMargins(30, 30, 30, 30);
    contentLayout->setSpacing(0); // Handled by stacked views

    // QStackedWidget Setup
    stackedWidget = new QStackedWidget(contentArea);
    dashboardView = new QWidget(stackedWidget);
    detailView = new ModpackDetailView(stackedWidget);

    QVBoxLayout *dashLayout = new QVBoxLayout(dashboardView);
    dashLayout->setContentsMargins(0, 0, 0, 0);
    dashLayout->setSpacing(20);

    QLabel *headerLabel = new QLabel("Welcome Back!", dashboardView);
    headerLabel->setStyleSheet("font-size: 24px; font-weight: bold; color: #FFFFFF;");
    dashLayout->addWidget(headerLabel);

    // Add a Grid frame container for Modpacks
    gridLayoutWidget = new QWidget(dashboardView);
    gridLayoutWidget->setStyleSheet("background-color: rgba(30, 41, 59, 0.5); border-radius: 12px;");
    QVBoxLayout *gridLayout = new QVBoxLayout(gridLayoutWidget);
    gridLayout->setContentsMargins(15, 15, 15, 15);
    gridLayout->setSpacing(10);
    
    QLabel *dashLabel = new QLabel("📥 Loading modpacks...", gridLayoutWidget);
    dashLabel->setStyleSheet("color: #94A3B8; font-size: 14px;");
    dashLabel->setAlignment(Qt::AlignCenter);
    gridLayout->addWidget(dashLabel);
    
    dashLayout->addWidget(gridLayoutWidget, 1); // Expand to fill

    // Add views to layout stack
    stackedWidget->addWidget(dashboardView);
    stackedWidget->addWidget(detailView);

    contentLayout->addWidget(stackedWidget, 1);

    // Connect detail view back button triggers
    connect(detailView, &ModpackDetailView::backRequested, [this]() {
        stackedWidget->setCurrentIndex(0);
    });

    // Assemble Main Layout
    mainLayout->addWidget(sidebar);
    mainLayout->addWidget(contentArea, 1);
}

void MainWindow::applyStyles() {
    // Glassmorphism Stylesheet simulating dark slate aesthetic
    this->setStyleSheet(
        "QMainWindow { background-color: #020617; }"
        "QWidget#contentArea { background-color: #020617; }"
        "QWidget#sidebar { background-color: #0F172A; border-right: 1px solid #1E293B; }"
        "QPushButton { "
        "  background-color: transparent; border: none; text-align: left; padding: 12px 15px; "
        "  color: #94A3B8; font-size: 14px; border-radius: 8px; "
        "} "
        "QPushButton:hover { background-color: rgba(96, 165, 251, 0.1); color: #60A5FA; }"
    );
}

void MainWindow::onModpacksLoaded(const QList<Modpack> &modpacks) {
    qDebug() << "✅ MainWindow: Received" << modpacks.size() << "modpacks";

    QLayout *layout = gridLayoutWidget->layout();
    
    // Clear loading label
    QLayoutItem *item;
    while ((item = layout->takeAt(0)) != nullptr) {
        delete item->widget();
        delete item;
    }

    // Populate using small items cards
    for (const Modpack &pack : modpacks) {
        QFrame *card = new QFrame(gridLayoutWidget);
        card->setStyleSheet("background-color: #1E293B; border-radius: 8px; border: 1px solid #334155;");
        QHBoxLayout *hLayout = new QHBoxLayout(card);
        hLayout->setContentsMargins(10, 10, 10, 10);

        QLabel *title = new QLabel(pack.name, card);
        title->setStyleSheet("font-weight: bold; color: #F8FAFC; font-size: 14px;");
        
        QLabel *desc = new QLabel(pack.description, card);
        desc->setStyleSheet("color: #94A3B8; font-size: 12px;");
        desc->setWordWrap(true);

        QVBoxLayout *vText = new QVBoxLayout();
        vText->addWidget(title);
        vText->addWidget(desc, 1);

        QPushButton *launchBtn = new QPushButton("Play", card);
        launchBtn->setStyleSheet("background-color: #2563EB; color: white; padding: 6px 12px; border-radius: 4px; font-weight: bold;");
        launchBtn->setFixedWidth(80);
        launchBtn->setCursor(Qt::PointingHandCursor);

        // Connect click to Details View
        connect(launchBtn, &QPushButton::clicked, [this, pack]() {
            this->onOpenModpackDetail(pack);
        });

        hLayout->addLayout(vText, 1);
        hLayout->addWidget(launchBtn);

        layout->addWidget(card);
    }
}

void MainWindow::onLoadFailed(const QString &error) {
    qDebug() << "❌ MainWindow: Load failed" << error;
    
    QLayout *layout = gridLayoutWidget->layout();
    
    // Clear loading label
    QLayoutItem *item;
    while ((item = layout->takeAt(0)) != nullptr) {
        delete item->widget();
        delete item;
    }

    QLabel *errorLabel = new QLabel("Failed to load modpacks:\n" + error, gridLayoutWidget);
    errorLabel->setStyleSheet("color: #EF4444;");
    errorLabel->setAlignment(Qt::AlignCenter);
    layout->addWidget(errorLabel);
}

void MainWindow::onOpenModpackDetail(const Modpack &pack) {
    qDebug() << "🔍 Opening detail for:" << pack.name;
    detailView->setModpack(pack);
    stackedWidget->setCurrentIndex(1); // Switch to DetailView page index
}
