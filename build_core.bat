@echo off
set PATH=C:\Qt\Tools\mingw1310_64\bin;C:\Qt\6.11.0\mingw_64\bin;%PATH%
cd cpp-core
if exist build rmdir /s /q build
C:\Qt\Tools\CMake_64\bin\cmake.exe -S . -B build -G "MinGW Makefiles" -DCMAKE_PREFIX_PATH="C:/Qt/6.11.0/mingw_64" -DCMAKE_CXX_COMPILER="C:/Qt/Tools/mingw1310_64/bin/g++.exe" -DCMAKE_C_COMPILER="C:/Qt/Tools/mingw1310_64/bin/gcc.exe" -DCMAKE_MAKE_PROGRAM="C:/Qt/Tools/mingw1310_64/bin/mingw32-make.exe"
C:\Qt\Tools\CMake_64\bin\cmake.exe --build build
C:\Qt\6.11.0\mingw_64\bin\windeployqt.exe --compiler-runtime build\LuminaCore.exe
