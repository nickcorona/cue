# Locks Chrome on this Windows PC so the Cue extension can't be removed or worked around:
# force-installs it from the Chrome Web Store (no Remove or Turn off button), and turns off
# Incognito, Guest mode and adding new profiles. Run once in an admin PowerShell:
#   powershell -ExecutionPolicy Bypass -File lock-chrome.ps1
# Undo: run it with -Undo. Only works once the extension is live on the Web Store.
param([switch]$Undo)
$ErrorActionPreference = 'Stop'
$id = 'lmigcgndpjbgliecalmgmgdhahbfbgah'
$chrome = 'HKLM:\SOFTWARE\Policies\Google\Chrome'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this from PowerShell opened with "Run as administrator".'
}

if ($Undo) {
  Remove-Item "$chrome\ExtensionInstallForcelist" -Recurse -ErrorAction SilentlyContinue
  foreach ($v in 'IncognitoModeAvailability', 'BrowserGuestModeEnabled', 'BrowserAddPersonEnabled') {
    Remove-ItemProperty $chrome -Name $v -ErrorAction SilentlyContinue
  }
  Write-Host 'Chrome lock removed. Restart Chrome.'
  exit
}

New-Item "$chrome\ExtensionInstallForcelist" -Force | Out-Null
Set-ItemProperty "$chrome\ExtensionInstallForcelist" -Name '1' -Value "$id;https://clients2.google.com/service/update2/crx"
Set-ItemProperty $chrome -Name 'IncognitoModeAvailability' -Value 1 -Type DWord   # 1 = Incognito off
Set-ItemProperty $chrome -Name 'BrowserGuestModeEnabled' -Value 0 -Type DWord
Set-ItemProperty $chrome -Name 'BrowserAddPersonEnabled' -Value 0 -Type DWord
Write-Host 'Chrome locked. Restart Chrome, then check chrome://policy shows the four policies.'
