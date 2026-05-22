@echo off

if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx86\x64\link.exe" (
  set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx86\x64;%PATH%"
  set "LIB=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\lib\x64;%LIB%"
)

if exist "C:\Program Files (x86)\Windows Kits\10\Lib" (
  for /f "delims=" %%D in ('dir /b /ad "C:\Program Files (x86)\Windows Kits\10\Lib" 2^>nul ^| sort /r') do (
    if exist "C:\Program Files (x86)\Windows Kits\10\Lib\%%D\um\x64\kernel32.lib" (
      set "LIB=%LIB%;C:\Program Files (x86)\Windows Kits\10\Lib\%%D\um\x64"
    )
    if exist "C:\Program Files (x86)\Windows Kits\10\Lib\%%D\ucrt\x64\ucrt.lib" (
      set "LIB=%LIB%;C:\Program Files (x86)\Windows Kits\10\Lib\%%D\ucrt\x64"
    )
    goto :done
  )
)

:done
