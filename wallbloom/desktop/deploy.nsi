!include "common.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"
!include "MUI2.nsh"

RequestExecutionLevel user
CRCCheck on
AutoCloseWindow true
Caption "WallWave — выбор папки"
!ifdef MUI_ICON
  Icon "${MUI_ICON}"
!endif

Var InstallRoot
Var ParentFolder
Var ConfigFile
Var PathLabel
Var MutexHandle
Var TestHome
Var RuntimeFolder
Var StageFolder
Var PromoteRetries

Page custom ChooseFolder LeaveFolder
!insertmacro MUI_PAGE_INSTFILES
!insertmacro addLangs

Function NormalizeRoot
  GetFullPathName $InstallRoot "$ParentFolder"
  ${GetFileName} "$InstallRoot" $0
  StrCmp $0 "WallWave" +2
    StrCpy $InstallRoot "$InstallRoot\WallWave"
FunctionEnd

Function CheckExisting
  GetFullPathName $0 "$InstallRoot"
  StrCmp $0 "$InstallRoot" 0 invalid
  ${GetFileName} "$InstallRoot" $0
  StrCmp $0 "WallWave" 0 invalid
  ReadINIStr $0 "$InstallRoot\installation.ini" "WallWave" "Product"
  StrCmp $0 "${APP_ID}" 0 invalid
  IfFileExists "$InstallRoot\WallWave.exe" valid invalid
  valid:
    Return
  invalid:
    StrCpy $InstallRoot ""
FunctionEnd

Function .onInit
  StrCpy $LANGUAGE 1049
  !insertmacro check64BitAndSetRegView
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\WallWaveDeployment-${APP_GUID}") p .r0 ?e'
  StrCpy $MutexHandle $0
  Pop $1
  StrCmp $1 183 0 +3
    MessageBox MB_OK "Выбор папки или распаковка WallWave уже выполняется."
    Quit
  StrCpy $ConfigFile "$APPDATA\Wallbloom\installation.ini"
  ReadEnvStr $0 WALLBLOOM_DESKTOP_TEST
  StrCmp $0 "1" 0 config_ready
  ReadEnvStr $TestHome WALLBLOOM_DESKTOP_TEST_HOME
  StrCmp $TestHome "" config_ready
  StrCpy $ConfigFile "$TestHome\installation.ini"
  config_ready:
  StrCpy $InstallRoot "$EXEDIR"
  Call CheckExisting
  StrCmp $InstallRoot "" 0 remembered
  ReadINIStr $InstallRoot "$ConfigFile" "WallWave" "Directory"
  Call CheckExisting
  StrCmp $InstallRoot "" 0 remembered
  StrCpy $ParentFolder "$LOCALAPPDATA"
  ReadEnvStr $0 WALLBLOOM_DESKTOP_TEST
  StrCmp $0 "1" 0 first_run
  StrCmp $TestHome "" first_run
  ReadEnvStr $ParentFolder WALLWAVE_TEST_INSTALL_PARENT
  StrCmp $ParentFolder "" first_run
  Call NormalizeRoot
  Call ValidateRoot
  SetSilent silent
  Return
  first_run:
  IfSilent 0 +3
    SetErrorLevel 2
    Quit
  Return
  remembered:
  SetSilent silent
FunctionEnd

Function ChooseFolder
  nsDialogs::Create 1018
  Pop $0
  StrCmp $0 error 0 +2
    Abort
  ${NSD_CreateLabel} 0 0 100% 42u "Где разместить WallWave?$\r$\nВыберите папку. Приложение всегда будет внутри отдельной папки WallWave."
  Pop $0
  ${NSD_CreateLabel} 0 52u 100% 30u ""
  Pop $PathLabel
  ${NSD_CreateButton} 0 92u 110u 24u "Выбрать папку…"
  Pop $0
  ${NSD_OnClick} $0 BrowseFolder
  ${NSD_CreateLabel} 0 126u 100% 28u "Нажмите «Далее», чтобы распаковать и запустить приложение. Отмена оставит всё как было."
  Pop $0
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Распаковать"
  Call UpdatePathLabel
  nsDialogs::Show
FunctionEnd

Function UpdatePathLabel
  Call NormalizeRoot
  ${NSD_SetText} $PathLabel "$InstallRoot"
FunctionEnd

Function BrowseFolder
  nsDialogs::SelectFolderDialog "Где создать папку WallWave?" "$ParentFolder"
  Pop $0
  StrCmp $0 error done
  StrCpy $ParentFolder "$0"
  Call UpdatePathLabel
  done:
FunctionEnd

Function ValidateRoot
  StrCpy $0 "$InstallRoot"
  Call CheckNoLinks
  StrCpy $0 "$InstallRoot\app"
  Call CheckNoLinks
  StrCpy $0 "$InstallRoot\app\${VERSION}"
  Call CheckNoLinks
  ; Never overwrite a directory belonging to another application or the user.
  IfFileExists "$InstallRoot\*" 0 valid
  ReadINIStr $0 "$InstallRoot\installation.ini" "WallWave" "Product"
  StrCmp $0 "${APP_ID}" valid
  FindFirst $1 $0 "$InstallRoot\*"
  loop:
    StrCmp $0 "" empty
    StrCmp $0 "." next
    StrCmp $0 ".." next
    FindClose $1
    MessageBox MB_OK|MB_ICONEXCLAMATION "Эта папка WallWave уже содержит другие файлы. Выберите другое место, чтобы их сохранить."
    Abort
  next:
    FindNext $1 $0
    Goto loop
  empty:
    FindClose $1
  valid:
FunctionEnd

Function CheckNoLinks
  System::Call 'kernel32::GetFileAttributesW(w "$0") i .r1'
  StrCmp $1 -1 valid
  IntOp $1 $1 & 1024
  StrCmp $1 0 valid
    MessageBox MB_OK|MB_ICONEXCLAMATION "Папки приложения не должны быть ссылками на другие папки. Выберите другое место."
    Abort
  valid:
FunctionEnd

Function LeaveFolder
  Call NormalizeRoot
  Call ValidateRoot
FunctionEnd

Section
  InitPluginsDir
  ClearErrors
  StrCpy $RuntimeFolder "$InstallRoot\app\${VERSION}"
  ReadINIStr $0 "$InstallRoot\installation.ini" "WallWave" "Version"
  StrCmp $0 "${VERSION}" 0 extract
  IfFileExists "$RuntimeFolder\resources\app.asar" 0 extract
  IfFileExists "$RuntimeFolder\${APP_EXECUTABLE_FILENAME}" launch extract
  extract:
  Call ValidateRoot
  ClearErrors
  SetOutPath "$InstallRoot"
  IfErrors failed
  WriteINIStr "$InstallRoot\installation.ini" "WallWave" "Product" "${APP_ID}"
  IfErrors failed
  IfFileExists "$RuntimeFolder\resources\app.asar" 0 check_partial
  IfFileExists "$RuntimeFolder\${APP_EXECUTABLE_FILENAME}" copy_launcher check_partial
  check_partial:
  ; Each version has its own folder. Existing files and previous versions are preserved.
  IfFileExists "$RuntimeFolder\*" 0 fresh
    MessageBox MB_OK|MB_ICONEXCLAMATION "Папка этой версии уже существует, но установка не завершена. Выберите другое место для WallWave."
    SetErrorLevel 3
    Quit
  fresh:
  ClearErrors
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  StrCpy $StageFolder "$InstallRoot\app\.stage-${VERSION}-$0"
  IfFileExists "$StageFolder\*" failed
  SetOutPath "$StageFolder"
  IfErrors failed
  File /oname=$PLUGINSDIR\application.7z "${APP_64}"
  Nsis7z::Extract "$PLUGINSDIR\application.7z"
  IfErrors failed
  IfFileExists "$StageFolder\${APP_EXECUTABLE_FILENAME}" 0 failed
  IfFileExists "$StageFolder\resources\app.asar" 0 failed
  SetOutPath "$InstallRoot"
  IfErrors failed
  StrCpy $PromoteRetries 10
  promote_runtime:
  ClearErrors
  Rename "$StageFolder" "$RuntimeFolder"
  IfErrors 0 copy_launcher
  IntOp $PromoteRetries $PromoteRetries - 1
  StrCmp $PromoteRetries 0 failed
  Sleep 500
  Goto promote_runtime
  copy_launcher:
  SetOutPath "$InstallRoot"
  StrCmp $EXEPATH "$InstallRoot\WallWave.exe" copied
  CopyFiles /SILENT "$EXEPATH" "$InstallRoot\WallWave.exe"
  IfErrors failed
  copied:
  File /oname=README.md "${PROJECT_DIR}\desktop\deployment-readme.md"
  File /oname=LICENSE "${PROJECT_DIR}\LICENSE"
  WriteINIStr "$InstallRoot\installation.ini" "WallWave" "Product" "${APP_ID}"
  WriteINIStr "$InstallRoot\installation.ini" "WallWave" "Version" "${VERSION}"
  WriteINIStr "$InstallRoot\installation.ini" "WallWave" "Runtime" "app\${VERSION}"
  IfErrors failed
  launch:
  Call ValidateRoot
  ClearErrors
  ${GetParent} "$ConfigFile" $0
  CreateDirectory "$0"
  IfErrors failed
  IfFileExists "$ConfigFile" config_exists
  FileOpen $0 "$ConfigFile" w
  IfErrors failed
  FileWriteWord $0 65279
  FileClose $0
  config_exists:
  WriteINIStr "$ConfigFile" "WallWave" "Directory" "$InstallRoot"
  IfErrors failed
  System::Call 'kernel32::CloseHandle(p $MutexHandle)'
  StrCpy $MutexHandle 0
  System::Call 'kernel32::SetEnvironmentVariableW(w "PORTABLE_EXECUTABLE_DIR", w "$InstallRoot")'
  System::Call 'kernel32::SetEnvironmentVariableW(w "PORTABLE_EXECUTABLE_FILE", w "$InstallRoot\WallWave.exe")'
  ${StdUtils.GetAllParameters} $R0 0
  ; Runtime files live outside the installer's temporary folder, so the
  ; application must run independently and the extraction window can close.
  ClearErrors
  Exec '"$RuntimeFolder\${APP_EXECUTABLE_FILENAME}" $R0'
  IfErrors failed
  SetErrorLevel 0
  Goto done
  failed:
  MessageBox MB_OK|MB_ICONSTOP "Не удалось разместить WallWave. Проверьте свободное место и доступ к выбранной папке."
  SetErrorLevel 4
  done:
SectionEnd

Function .onGUIEnd
  StrCmp $MutexHandle 0 +2
    System::Call 'kernel32::CloseHandle(p $MutexHandle)'
FunctionEnd
