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
