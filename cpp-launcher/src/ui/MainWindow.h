#pragma once

#include <QMainWindow>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QWidget>
#include <QPushButton>
#include "../network/APIService.h"
#include <QStackedWidget>
#include "ModpackDetailView.h"
#include "../Launcher.h"

/**
 * @brief The main dashboard and navigation container window
 */
class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private:
    void setupUi();
    void applyStyles();

private slots:
    void onModpacksLoaded(const QList<Modpack> &modpacks);
    void onLoadFailed(const QString &error);
    void onOpenModpackDetail(const Modpack &pack);

    QWidget *centralWidget;
    QHBoxLayout *mainLayout; // Sidebar + Content area
    
    // Sidebar Navigation
    QWidget *sidebar;
    QVBoxLayout *sidebarLayout;

    // Main Content
    QWidget *contentArea;
    QVBoxLayout *contentLayout;

    APIService *apiService;
    QWidget *gridLayoutWidget; // Grid Canvas container

    QStackedWidget *stackedWidget;
    QWidget *dashboardView;
    ModpackDetailView *detailView;

    Launcher *launcher;
};
