; ARWAAT: two shortcuts per place (Desktop + Start Menu) instead of
; electron-builder's single default one. Both start the same exe; the
; --mode argument picks the Admin or the Cashier window (one running app
; serves both). Each shortcut carries its window's AppUserModelID so a
; pinned shortcut groups with its own window on the taskbar
; (see src/main/windows.js setAppDetails).

!macro arwaatShortcut LINK MODE
  CreateShortCut "${LINK}" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--mode=${MODE}" "$INSTDIR\resources\icons\${MODE}.ico" 0
  WinShell::SetLnkAUMI "${LINK}" "com.arwaat.stationerysystems.${MODE}"
!macroend

!macro customInstall
  !insertmacro arwaatShortcut "$DESKTOP\ARWAAT Admin.lnk" "admin"
  !insertmacro arwaatShortcut "$DESKTOP\ARWAAT Cashier.lnk" "cashier"
  !insertmacro arwaatShortcut "$SMPROGRAMS\ARWAAT Admin.lnk" "admin"
  !insertmacro arwaatShortcut "$SMPROGRAMS\ARWAAT Cashier.lnk" "cashier"
!macroend

!macro customUnInstall
  WinShell::UninstShortcut "$DESKTOP\ARWAAT Admin.lnk"
  WinShell::UninstShortcut "$DESKTOP\ARWAAT Cashier.lnk"
  WinShell::UninstShortcut "$SMPROGRAMS\ARWAAT Admin.lnk"
  WinShell::UninstShortcut "$SMPROGRAMS\ARWAAT Cashier.lnk"
  Delete "$DESKTOP\ARWAAT Admin.lnk"
  Delete "$DESKTOP\ARWAAT Cashier.lnk"
  Delete "$SMPROGRAMS\ARWAAT Admin.lnk"
  Delete "$SMPROGRAMS\ARWAAT Cashier.lnk"
!macroend
