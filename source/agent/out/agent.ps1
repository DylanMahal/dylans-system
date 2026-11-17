param([switch]$Setup,[switch]$Autostart)
# Dylan's System - laptop sync agent. Keeps Stack Budget.xlsx and the app in step through Excel.
$ErrorActionPreference = 'Stop'
$DefaultUrl = 'https://ucnwefjblxqbmmwdbqhw.supabase.co'
$DefaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjbndlZmpibHhxYm1td2RicWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1NzczMDEsImV4cCI6MjExMDE1MzMwMX0.6jv9kXXMt6h2SmBA_zcPRQ23b7lAMw0DvVcaPB4DrVk'
$DefaultXlsx = 'C:\Users\dylan\OneDrive\Documents\Stack Budget.xlsx'
$inv = [System.Globalization.CultureInfo]::InvariantCulture
function J($o) {
  if ($o -is [System.Management.Automation.PSObject]) { $o = $o.psobject.BaseObject }
  if ($null -eq $o -or $o -is [System.DBNull]) { return 'null' }
  if ($o -is [string] -or $o -is [char]) {
    $t = ([string]$o).Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n').Replace("`t", '\t')
    $t = [regex]::Replace($t, '[\u0000-\u001f]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
    return '"' + $t + '"'
  }
  if ($o -is [bool]) { if ($o) { return 'true' } else { return 'false' } }
  if ($o -is [double] -or $o -is [single] -or $o -is [decimal] -or $o -is [int] -or $o -is [long] -or $o -is [int16] -or $o -is [byte]) {
    $d = [double]$o
    if ([double]::IsNaN($d) -or [double]::IsInfinity($d)) { return 'null' }
    return $d.ToString('R', $inv)
  }
  if ($o -is [datetime]) { return '"' + $o.ToString('o') + '"' }
  if ($o -is [System.Collections.IDictionary]) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($k in $o.Keys) { $parts.Add((J ([string]$k)) + ':' + (J $o[$k])) }
    return '{' + ($parts -join ',') + '}'
  }
  if ($o -is [System.Collections.IEnumerable]) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($x in $o) { $parts.Add((J $x)) }
    return '[' + ($parts -join ',') + ']'
  }
  return (J ([string]$o))
}

# ---------- setup / config ----------
$Dir = Join-Path $env:LOCALAPPDATA 'DylansSystem'
if (-not (Test-Path $Dir)) { New-Item -ItemType Directory -Path $Dir | Out-Null }
$CfgFile = Join-Path $Dir 'config.json'
$TokFile = Join-Path $Dir 'token.dat'
$StateFile = Join-Path $Dir 'state.json'
$LogFile = Join-Path $Dir 'agent.log'
$VERSION = '1.0.3'
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = 104857600
$utf8 = New-Object System.Text.UTF8Encoding $false

function Log($m) {
  try {
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 1MB)) { Move-Item $LogFile "$LogFile.old" -Force }
    Add-Content -Path $LogFile -Value ("{0}  {1}" -f (Get-Date).ToString('s'), $m) -Encoding UTF8
  } catch {}
}
function ReadJson($path) { if (Test-Path $path) { return $ser.DeserializeObject([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)) } return $null }
function WriteJson($path, $obj) { [IO.File]::WriteAllText($path, (J $obj), $utf8) }

function InstallAutostart($self) {
  $startup = [Environment]::GetFolderPath('Startup')
  $old = Join-Path $startup 'DylansSystemSync.vbs'; if (Test-Path $old) { Remove-Item $old -Force -ErrorAction SilentlyContinue }
  try { schtasks.exe /Delete /TN 'DylansSystemSync' /F 2>$null | Out-Null } catch {}
  $ws = New-Object -ComObject WScript.Shell
  $lnk = $ws.CreateShortcut((Join-Path $startup "Dylan's System sync.lnk"))
  $lnk.TargetPath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
  $lnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$self`""
  $lnk.WindowStyle = 7
  $lnk.WorkingDirectory = $Dir
  $lnk.Description = "Dylan's System - keeps Stack Budget.xlsx in sync with the app"
  $lnk.Save()
  Start-Process -FilePath $lnk.TargetPath -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$self`"" -WindowStyle Hidden
}
if ($Autostart) {
  InstallAutostart (Join-Path $Dir 'agent.ps1')
  Write-Host '  Sync agent started and set to run at every log-in.' -ForegroundColor Green
  Start-Sleep -Seconds 3; exit 0
}

$Cfg = ReadJson $CfgFile
if ($Setup -or -not $Cfg -or -not (Test-Path $TokFile)) {
  Write-Host ''
  Write-Host '  Dylan''s System - laptop sync setup' -ForegroundColor Magenta
  Write-Host '  Links Stack Budget.xlsx to your app. Run once.' -ForegroundColor DarkGray
  Write-Host ''
  $url = $DefaultUrl; $key = $DefaultKey; $xlsx = $DefaultXlsx
  if (-not (Test-Path -LiteralPath $xlsx)) { $xlsx = Read-Host '  Full path to Stack Budget.xlsx' }
  $email = Read-Host '  App email'
  $sec = Read-Host '  App password' -AsSecureString
  $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  $wc = New-Object System.Net.WebClient; $wc.Encoding = [Text.Encoding]::UTF8
  $wc.Headers.Add('apikey', $key); $wc.Headers.Add('Content-Type', 'application/json')
  try { $res = $ser.DeserializeObject($wc.UploadString("$url/auth/v1/token?grant_type=password", 'POST', (J @{ email = $email; password = $pw }))) }
  catch { Write-Host "  Sign-in failed: $($_.Exception.Message)" -ForegroundColor Red; Read-Host '  Press Enter to close'; exit 1 }
  $pw = $null
  WriteJson $CfgFile @{ url = $url; key = $key; xlsx = $xlsx; uid = $res['user']['id'] }
  ConvertTo-SecureString $res['refresh_token'] -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Path $TokFile -Encoding ASCII
  # run at every log-in, hidden
  $self = Join-Path $Dir 'agent.ps1'
  if ($MyInvocation.MyCommand.Path -ne $self) { Copy-Item -LiteralPath $MyInvocation.MyCommand.Path -Destination $self -Force }
  $tr = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$self`""
  InstallAutostart $self
  Write-Host ''
  Write-Host '  Done. The sync agent is running and will start by itself whenever you log in.' -ForegroundColor Green
  Write-Host "  Log: $LogFile" -ForegroundColor DarkGray
  Start-Sleep -Seconds 4
  exit 0
}

trap { Log ("FATAL: " + $_.Exception.Message + " | " + ($_.InvocationInfo.PositionMessage -replace "`r?`n",' ')); Write-Host ("FATAL: " + $_); exit 1 }
Log "boot pid=$PID ps=$($PSVersionTable.PSVersion)"

# ---------- single instance ----------
$script:mutex = New-Object System.Threading.Mutex($false, 'Local\DylansSystemSync')
if (-not $script:mutex.WaitOne(0)) { Log "another agent is already running - exiting"; exit 0 }
try { $script:lockFs = [IO.File]::Open((Join-Path $Dir 'agent.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { Log "agent.lock held by another agent - exiting"; exit 0 }

# ---------- Supabase REST ----------
$Url = $Cfg['url']; $Key = $Cfg['key']; $Xlsx = $Cfg['xlsx']; $Uid = $Cfg['uid']
$script:Access = $null; $script:AccessExp = [DateTime]::MinValue
function RefreshToken {
  $rt = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Get-Content $TokFile | ConvertTo-SecureString)))
  $wc = New-Object System.Net.WebClient; $wc.Encoding = [Text.Encoding]::UTF8
  $wc.Headers.Add('apikey', $Key); $wc.Headers.Add('Content-Type', 'application/json')
  $res = $ser.DeserializeObject($wc.UploadString("$Url/auth/v1/token?grant_type=refresh_token", 'POST', (J @{ refresh_token = $rt })))
  $script:Access = $res['access_token']; $script:AccessExp = (Get-Date).AddSeconds([int]$res['expires_in'] - 120)
  ConvertTo-SecureString $res['refresh_token'] -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Path $TokFile -Encoding ASCII
}
function Rest($method, $path, $body, $prefer) {
  if (-not $script:Access -or (Get-Date) -gt $script:AccessExp) { RefreshToken }
  $wc = New-Object System.Net.WebClient; $wc.Encoding = [Text.Encoding]::UTF8
  $wc.Headers.Add('apikey', $Key); $wc.Headers.Add('Authorization', "Bearer $($script:Access)")
  $wc.Headers.Add('Content-Type', 'application/json'); if ($prefer) { $wc.Headers.Add('Prefer', $prefer) }
  if ($method -eq 'GET') { $txt = $wc.DownloadString("$Url/rest/v1/$path") } else { $txt = $wc.UploadString("$Url/rest/v1/$path", $method, $(if ($body) { $body } else { '' })) }
  if ($txt) { return ,($ser.DeserializeObject($txt)) } return $null
}
function enc($s) { return [Uri]::EscapeDataString($s) }
function GetDoc($p) { $r = Rest 'GET' "kv?select=data&path=eq.$(enc $p)"; if ($r -and $r.Count -gt 0) { return $r[0]['data'] } return $null }
function PutDoc($p, $data) {
  $row = '{"user_id":' + (J $Uid) + ',"path":' + (J $p) + ',"data":' + (J $data) + ',"updated_at":' + (J ((Get-Date).ToUniversalTime().ToString('o'))) + '}'
  [void](Rest 'POST' 'kv?on_conflict=user_id,path' "[$row]" 'resolution=merge-duplicates,return=minimal')
}
function DelDoc($p) { [void](Rest 'DELETE' "kv?path=eq.$(enc $p)" $null 'return=minimal') }
function EditKeys { $r = Rest 'GET' 'kv?select=path&path=like.edits%2F*'; $s = @{}; foreach ($x in $r) { $s[([string]$x['path']).Substring(6)] = 1 }; return $s }

# ---------- Excel ----------
function WithWorkbook([scriptblock]$work) {
  $xl = $null; $wb = $null; $createdApp = $false; $openedBook = $false
  try {
    try { $xl = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application') } catch { $xl = $null }
    if ($null -eq $xl) { $xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false; $createdApp = $true }
    $name = [IO.Path]::GetFileName($Xlsx)
    foreach ($b in $xl.Workbooks) { if ($b.Name -eq $name) { $wb = $b } }
    if ($null -eq $wb) { $wb = $xl.Workbooks.Open($Xlsx); $openedBook = $true }
    return (& $work $wb)
  } finally {
    try { if ($openedBook -and $null -ne $wb) { $wb.Close($false) } } catch {}
    try { if ($createdApp -and $null -ne $xl) { $xl.Quit() } } catch {}
    if ($null -ne $wb) { try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wb) } catch {} }
    if ($null -ne $xl) { try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) } catch {} }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  }
}
function ReadSheets {
  return WithWorkbook {
    param($wb)
    $sheets = @{}
    foreach ($n in @('Stack', 'Expenses', 'Expenses Summary', 'Day Plan v2', 'Weekend Plan')) {
      $ws = $wb.Worksheets.Item($n); $ur = $ws.UsedRange
      $r0 = [int]$ur.Row; $c0 = [int]$ur.Column; $nr = [int]$ur.Rows.Count; $nc = [int]$ur.Columns.Count
      $lastCol = [Math]::Min($c0 + $nc - 1, 14); $v = $ur.Value2
      $grid = New-Object System.Collections.ArrayList
      for ($i = 1; $i -lt $r0; $i++) { [void]$grid.Add(@()) }
      for ($i = 1; $i -le $nr; $i++) {
        $row = New-Object System.Collections.ArrayList
        for ($c = 1; $c -le $lastCol; $c++) {
          if ($c -lt $c0) { [void]$row.Add($null); continue }
          $j = $c - $c0 + 1
          if ($nr -eq 1 -and $nc -eq 1) { $val = $v } else { $val = $v[$i, $j] }
          [void]$row.Add($val)
        }
        while ($row.Count -gt 0 -and ($null -eq $row[$row.Count - 1] -or ($row[$row.Count - 1] -is [string] -and $row[$row.Count - 1] -eq ''))) { $row.RemoveAt($row.Count - 1) }
        [void]$grid.Add($row)
      }
      $sheets[$n] = $grid
    }
    return $sheets
  }
}
function ApplyOps($ops) {
  return WithWorkbook {
    param($wb)
    $results = New-Object System.Collections.ArrayList
    foreach ($op in $ops) {
      $id = [string]$op['id']
      try {
        $ws = $wb.Worksheets.Item([string]$op['sheet']); $kind = [string]$op['op']
        if ($kind -eq 'insert') { $checkRow = [int]$op['copy'] } else { $checkRow = [int]$op['row'] }
        if ($op.ContainsKey('expect') -and $null -ne $op['expect']) {
          foreach ($k in $op['expect'].Keys) {
            $have = ([string]$ws.Cells.Item($checkRow, [int]$k).Text).Trim().ToLower()
            $want = ([string]$op['expect'][$k]).Trim().ToLower()
            if ($have -ne $want) { throw "Row $checkRow column $k reads '$have' but '$want' was expected (the sheet changed). Skipped." }
          }
        }
        $target = 0; $inserted = 0
        if ($kind -eq 'insert') { $at = [int]$op['at']; $src = [int]$op['copy']; [void]$ws.Rows.Item($at).Insert(); $inserted = $at; if ($src -ge $at) { $src++ }; [void]$ws.Rows.Item($src).Copy($ws.Rows.Item($at)); $target = $at }
        elseif ($kind -eq 'delete') { [void]$ws.Rows.Item([int]$op['row']).Delete() }
        else { $target = [int]$op['row'] }
        try {
          if ($target -gt 0 -and $op.ContainsKey('values') -and $null -ne $op['values']) {
            foreach ($k in @($op['values'].Keys)) {
              $col = [int]([string]$k); $cell = $ws.Cells.Item($target, $col); $val = $op['values'][$k]
              if ($null -eq $val -or ($val -is [string] -and $val -eq '')) { [void]$cell.ClearContents(); continue }
              if ($val -is [string]) { $cell.Value2 = [string]$val; continue }
              if ($val -is [bool]) { $cell.Value2 = [bool]$val; continue }
              $d = [double]$val
              try { $cell.Value2 = $d } catch { $cell.Formula = $d.ToString('R', $inv) }
            }
          }
        } catch {
          # never leave a half-made row behind: a failed insert is rolled back so a retry can't stack copies
          if ($inserted -gt 0) { try { [void]$ws.Rows.Item($inserted).Delete() } catch {} }
          throw ("{0} (line {1}: {2})" -f $_.Exception.Message, $_.InvocationInfo.ScriptLineNumber, ($_.InvocationInfo.Line.Trim() -replace '\s+',' ').Substring(0, [Math]::Min(90, ($_.InvocationInfo.Line.Trim()).Length)))
        }
        [void]$results.Add(@{ id = $id; ok = $true })
      } catch { [void]$results.Add(@{ id = $id; ok = $false; error = $_.Exception.Message }) }
    }
    $wb.Save()
    return , $results
  }
}

# ---------- main loop ----------
$State = ReadJson $StateFile; if (-not $State) { $State = @{} }
function SaveState { WriteJson $StateFile $State }
Log "agent $VERSION started for $Xlsx"
$lastBeat = [DateTime]::MinValue
$selfPath = Join-Path $Dir 'agent.ps1'; $selfStamp = (Get-Item -LiteralPath $selfPath -ErrorAction SilentlyContinue).LastWriteTimeUtc
while ($true) {
  # self-update: if agent.ps1 was replaced, start the new copy and exit
  $nowStamp = (Get-Item -LiteralPath $selfPath -ErrorAction SilentlyContinue).LastWriteTimeUtc
  if ($selfStamp -and $nowStamp -and $nowStamp -ne $selfStamp) {
    Log "agent.ps1 updated - restarting"
    try { $script:lockFs.Close() } catch {}; try { $script:mutex.ReleaseMutex() } catch {}
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$selfPath`"" -WindowStyle Hidden
    exit 0
  }
  $msg = ''; $ok = $true; $force = $false
  try {
    if (-not (Test-Path -LiteralPath $Xlsx)) { throw "Can't find $Xlsx" }
    # 0. one-off: remove rows that are exact copies of the row above in the plan sheets (left by failed inserts before 1.0.3)
    if (-not $State['dedup103']) {
      $n = WithWorkbook { param($wb)
        $gone = 0
        foreach ($sn in @('Day Plan v2', 'Weekend Plan')) { $ws = $wb.Worksheets.Item($sn); $last = [int]$ws.UsedRange.Row + [int]$ws.UsedRange.Rows.Count - 1
          for ($r = $last; $r -gt 4; $r--) { $a = @(1..9 | ForEach-Object { [string]$ws.Cells.Item($r, $_).Formula }); $b = @(1..9 | ForEach-Object { [string]$ws.Cells.Item($r - 1, $_).Formula })
            if (($a -join '') -ne '' -and ($a -join [char]31) -eq ($b -join [char]31)) { [void]$ws.Rows.Item($r).Delete(); $gone++ } } }
        if ($gone -gt 0) { $wb.Save() }; return $gone }
      Log "dedup: removed $n duplicated rows"; $State['dedup103'] = $true; SaveState; $force = $true
    }
    # 1. apply queued edits from any device
    $ops = GetDoc 'sync/ops'
    if ($ops -and $ops['at'] -and ([string]$ops['at']) -ne ([string]$State['opsAt']) -and $ops['ops'] -and $ops['ops'].Count -gt 0) {
      $present = EditKeys
      $todo = @($ops['ops'] | Where-Object { $present.ContainsKey(([string]$_['id']).Split('#')[0]) })
      if ($todo.Count -gt 0) {
        Log "applying $($todo.Count) ops"
        $res = @(ApplyOps $todo)
        $byKey = @{}
        foreach ($r in $res) { $k = ([string]$r['id']).Split('#')[0]; if (-not $byKey.ContainsKey($k)) { $byKey[$k] = $true }; if (-not $r['ok']) { $byKey[$k] = $false; Log "op $($r['id']) failed: $($r['error'])" } }
        foreach ($k in $byKey.Keys) { if ($byKey[$k]) { DelDoc ("edits/" + $k) } }
        PutDoc 'sync/result' @{ at = (Get-Date).ToUniversalTime().ToString('o'); opsAt = $ops['at']; results = [object[]]$res }
        $force = $true
      }
      $State['opsAt'] = [string]$ops['at']; SaveState
    }
    # 2. upload the sheets whenever the file changed
    $mt = (Get-Item -LiteralPath $Xlsx).LastWriteTimeUtc.ToString('o')
    if ($force -or $mt -ne [string]$State['mtime']) {
      $sheets = ReadSheets
      $slugs = @{ 'Stack' = 'stack'; 'Expenses' = 'expenses'; 'Expenses Summary' = 'summary'; 'Day Plan v2' = 'weekday'; 'Weekend Plan' = 'weekend' }
      foreach ($n in $slugs.Keys) { PutDoc ("sheet/s-" + $slugs[$n]) @{ rows = $sheets[$n] } }
      $mt = (Get-Item -LiteralPath $Xlsx).LastWriteTimeUtc.ToString('o')
      PutDoc 'sheet/meta' @{ at = (Get-Date).ToUniversalTime().ToString('o'); mtime = $mt; src = 'excel' }
      $State['mtime'] = $mt; SaveState
      Log "uploaded sheets ($mt)"
    }
  } catch { $ok = $false; $msg = $_.Exception.Message; Log ("error: " + $msg + " | " + ($_.InvocationInfo.PositionMessage -replace "`r?`n"," ") + " | " + ($_.ScriptStackTrace -replace "`r?`n"," <- ")) }
  # 3. heartbeat
  if ($ok -eq $false -or ((Get-Date) - $lastBeat).TotalSeconds -ge 55) {
    try { PutDoc 'agent/status' @{ at = (Get-Date).ToUniversalTime().ToString('o'); ok = $ok; msg = $msg; version = $VERSION; mtime = [string]$State['mtime'] }; $lastBeat = Get-Date } catch { Log "heartbeat failed: $($_.Exception.Message)" }
  }
  Start-Sleep -Seconds 20
}
