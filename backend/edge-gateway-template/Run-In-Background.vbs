' OnlineSCADA Edge Gateway - Silent Background Launcher
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get folder where this script lives
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Auto-install if needed (silent)
If Not fso.FolderExists(strPath & "\node_modules") Then
    WshShell.Run "cmd /c npm install --omit=dev --silent --no-audit --no-fund", 0, True
End If

' Launch gateway silently in background
WshShell.Run "cmd /c node src\index.js", 0, False