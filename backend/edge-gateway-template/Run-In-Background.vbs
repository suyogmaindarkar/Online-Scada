Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get folder where this script lives
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Launch Start-Gateway.bat silently
WshShell.Run "cmd /c Start-Gateway.bat", 0, False