@echo off
set PATH=C:\Qt\Tools\mingw1310_64\bin;C:\Qt\6.11.0\mingw_64\bin;%PATH%
cd cpp-core
:: Use a distinct build directory to avoid locks
if exist build_final rmdir /s /q build_final
mkdir build_final
C:\Qt\Tools\CMake_64\bin\cmake.exe -S . -B build_final -G "MinGW Makefiles" -DCMAKE_PREFIX_PATH="C:/Qt/6.11.0/mingw_64" -DCMAKE_CXX_COMPILER="C:/Qt/Tools/mingw1310_64/bin/g++.exe" -DCMAKE_C_COMPILER="C:/Qt/Tools/mingw1310_64/bin/gcc.exe" -DCMAKE_MAKE_PROGRAM="C:/Qt/Tools/mingw1310_64/bin/mingw32-make.exe"
C:\Qt\Tools\CMake_64\bin\cmake.exe --build build_final
C:\Qt\6.11.0\mingw_64\bin\windeployqt.exe --compiler-runtime build_final\LuminaCore.exe
