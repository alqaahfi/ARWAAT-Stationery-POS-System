# Clicks through a visible NSIS wizard: Next -> Install -> Finish. Prints each click.
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$exe = $args[0]
$p = Start-Process -FilePath $exe -PassThru
Write-Host "Installer started (pid $($p.Id)); clicking through the wizard..."
$deadline = (Get-Date).AddMinutes(6)
$names = @('Next >','Install','Finish','Close')
$lastClick = ''
$finished = $false
while((Get-Date) -lt $deadline -and -not $finished){
  Start-Sleep -Milliseconds 1200
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $p.Id)
  $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
  if($wins.Count -eq 0){ if($p.HasExited){ break } else { continue } }
  foreach($w in $wins){
    $btns = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)))
    foreach($b in $btns){
      $n = $b.Current.Name -replace '&',''
      if($names -contains $n -and $b.Current.IsEnabled){
        Write-Host "  clicking '$n'"
        try { ($b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke() } catch { Write-Host "  (invoke failed: $_)" }
        if($n -in 'Finish','Close'){ $finished = $true }
        Start-Sleep -Milliseconds 800
        break
      }
    }
    if($finished){ break }
  }
}
Write-Host "Installer wizard done."
