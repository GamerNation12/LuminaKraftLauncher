#pragma once

#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include "../models/Modpack.h"

/**
 * @brief View showing details for a selected modpack with continuous Play Triggers
 */
class ModpackDetailView : public QWidget {
    Q_OBJECT
public:
    explicit ModpackDetailView(QWidget *parent = nullptr);
    ~ModpackDetailView();

    /**
     * @brief Set the modpack to display and update the UI
     */
    void setModpack(const Modpack &pack);

signals:
    void backRequested();
    void playRequested(const QString &modpackId);

private:
    void setupUi();

    QLabel *titleLabel;
    QLabel *descLabel;
    QLabel *versionLabel;
    QLabel *logoLabel; 

    QPushButton *playBtn;
    QPushButton *backBtn;

    Modpack currentPack;
};
