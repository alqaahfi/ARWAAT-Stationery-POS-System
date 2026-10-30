# Answers a native Windows Save/Open dialog owned by the ARWAAT app: pastes the path into "File name", presses Enter.
param([string]$File, [int]$TimeoutSec = 40)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  $pids = @(Get-Process -Name 'ARWAAT Stationery Systems','electron' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  $dlgs = $AE::RootElement.FindAll($TS::Children, (New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, '#32770')))
  foreach ($d in $dlgs) {
    if ($pids -notcontains $d.Current.ProcessId) { continue }
    $edits = $d.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)))
    $edit = $null
    foreach ($e in $edits) { if ($e.Current.Name -match 'File name') { $edit = $e; break } }
    if (-not $edit -and $edits.Count -gt 0) { $edit = $edits[0] }
    if (-not $edit) { continue }
    $edit.SetFocus()
    Start-Sleep -Milliseconds 400
    Set-Clipboard -Value $File
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 700
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Write-Host "dialog answered: $File"
    exit 0
  }
}
Write-Host "no dialog found"; exit 1
