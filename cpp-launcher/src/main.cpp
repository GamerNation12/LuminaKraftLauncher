#include <QApplication>
#include "ui/MainWindow.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);

    MainWindow window;
    window.resize(1000, 650);
    window.setWindowTitle("LuminaKraft Launcher (C++)");
    window.show();

    return app.exec();
}
