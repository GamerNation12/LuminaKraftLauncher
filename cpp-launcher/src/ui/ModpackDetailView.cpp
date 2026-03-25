#include "ModpackDetailView.h"
#include <QHBoxLayout>
#include <QFrame>
#include <QDebug>

ModpackDetailView::ModpackDetailView(QWidget *parent) : QWidget(parent) {
    setupUi();
}

ModpackDetailView::~ModpackDetailView() {}

void ModpackDetailView::setupUi() {
    QVBoxLayout *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(20);

    // 1. Top Navigation Bar
    QWidget *navBar = new QWidget(this);
    QHBoxLayout *navLayout = new QHBoxLayout(navBar);
    navLayout->setContentsMargins(0, 0, 0, 0);

    backBtn = new QPushButton("← Back to Modpacks", navBar);
    backBtn->setCursor(Qt::PointingHandCursor);
    backBtn->setStyleSheet("background-color: transparent; color: #60A5FA; border: none; font-size: 14px; text-align: left;");
    connect(backBtn, &QPushButton::clicked, this, &ModpackDetailView::backRequested);

    navLayout->addWidget(backBtn);
    navLayout->addStretch();
    
    mainLayout->addWidget(navBar);

    // 2. Banner / Card Area
    QFrame *bannerFrame = new QFrame(this);
    bannerFrame->setStyleSheet("background-color: #1E293B; border-radius: 12px; border: 1px solid #334155;");
    QHBoxLayout *bannerLayout = new QHBoxLayout(bannerFrame);
    bannerLayout->setContentsMargins(20, 20, 20, 20);
    bannerLayout->setSpacing(20);

    logoLabel = new QLabel(bannerFrame);
    logoLabel->setFixedSize(64, 64);
    logoLabel->setStyleSheet("background-color: #0F172A; border-radius: 10px;"); // Placeholder logo
    bannerLayout->addWidget(logoLabel);

    QVBoxLayout *infoLayout = new QVBoxLayout();
    titleLabel = new QLabel("Modpack Title", bannerFrame);
    titleLabel->setStyleSheet("font-size: 24px; font-weight: bold; color: #F8FAFC;");
    
    versionLabel = new QLabel("Version: Latest", bannerFrame);
    versionLabel->setStyleSheet("color: #60A5FA; font-size: 14px;");

    infoLayout->addWidget(titleLabel);
    infoLayout->addWidget(versionLabel);
    infoLayout->addStretch();

    bannerLayout->addLayout(infoLayout, 1);

    playBtn = new QPushButton("Play", bannerFrame);
    playBtn->setStyleSheet("background-color: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: bold;");
    playBtn->setCursor(Qt::PointingHandCursor);
    connect(playBtn, &QPushButton::clicked, [this]() {
        emit playRequested(currentPack.id);
    });

    bannerLayout->addWidget(playBtn);
    mainLayout->addWidget(bannerFrame);

    // 3. Description Area
    QFrame *descFrame = new QFrame(this);
    descFrame->setStyleSheet("background-color: rgba(30, 41, 59, 0.5); border-radius: 12px;");
    QVBoxLayout *descLayout = new QVBoxLayout(descFrame);
    descLayout->setContentsMargins(20, 20, 20, 20);

    QLabel *descHeader = new QLabel("About this Modpack", descFrame);
    descHeader->setStyleSheet("font-size: 16px; font-weight: bold; color: #F8FAFC;");
    
    descLabel = new QLabel("Description text placeholder load.", descFrame);
    descLabel->setStyleSheet("color: #94A3B8; font-size: 14px;");
    descLabel->setWordWrap(true);

    descLayout->addWidget(descHeader);
    descLayout->addWidget(descLabel, 1);

    mainLayout->addWidget(descFrame, 1); // Expand to fill
}

void ModpackDetailView::setModpack(const Modpack &pack) {
    currentPack = pack;
    titleLabel->setText(pack.name);
    descLabel->setText(pack.description);
    versionLabel->setText("Version: " + pack.version);
    
    qDebug() << "DetailView: loaded items index:" << pack.id;
}
