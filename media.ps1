$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = [Console]::OutputEncoding

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
})[0]

function Await-WinRT($op, $type) {
  if ($null -eq $op) { return $null }
  try {
    $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
    if (-not $task.Wait(2000)) { return $null }
    return $task.Result
  } catch { return $null }
}

[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSession, Windows.Media.Control, ContentType=WindowsRuntime]
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]

$outPath = Join-Path $env:TEMP "lumen-media.json"
$logPath = Join-Path $env:TEMP "lumen-media.log"
$cmdPath = Join-Path $env:TEMP "lumen-cmd.json"
$artPath = Join-Path $env:TEMP "lumen-art.img"
$artKey = ""
$manager = $null

function Write-Status([string]$json) {
  try {
    [IO.File]::WriteAllText($outPath, $json, (New-Object System.Text.UTF8Encoding $false))
    [Console]::WriteLine($json)
    [Console]::Out.Flush()
  } catch {}
}

function Log([string]$text) {
  try { Add-Content -Path $logPath -Value ("{0} {1}" -f (Get-Date -Format "HH:mm:ss"), $text) } catch {}
}

function Pretty([string]$id) {
  if ($id -match "Spotify") { return "Spotify" }
  if ($id -match "Yandex|yandex") { return "Яндекс Музыка" }
  if ($id -match "chrome") { return "Chrome" }
  if ($id -match "msedge") { return "Edge" }
  if ($id -match "AIMP") { return "AIMP" }
  if ($id -match "vlc") { return "VLC" }
  if ($id -match "foobar") { return "foobar2000" }
  return "Плеер"
}

function Get-Manager {
  if ($manager) { return $manager }
  $script:manager = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  return $manager
}

function Pick-Session($mgr) {
  if (-not $mgr) { return $null }
  try {
    $sessions = @($mgr.GetSessions())
    $playing = $null
    $paused = $null
    foreach ($s in $sessions) {
      $st = [string]$s.GetPlaybackInfo().PlaybackStatus
      if ($st -eq "Playing" -and -not $playing) { $playing = $s }
      elseif ($st -eq "Paused" -and -not $paused) { $paused = $s }
    }
    if ($playing) { return $playing }
    if ($paused) { return $paused }
    return $mgr.GetCurrentSession()
  } catch { return $null }
}

Log "start"
while ($true) {
  try {
    $mgr = Get-Manager
    if (Test-Path $cmdPath) {
      try {
        $cmd = Get-Content -Raw -Path $cmdPath | ConvertFrom-Json
        Remove-Item $cmdPath -Force -ErrorAction SilentlyContinue
        $target = Pick-Session $mgr
        if ($target) {
          switch ([string]$cmd.op) {
            "play" { [void](Await-WinRT ($target.TryTogglePlayPauseAsync()) ([bool])) }
            "next" { [void](Await-WinRT ($target.TrySkipNextAsync()) ([bool])) }
            "prev" { [void](Await-WinRT ($target.TrySkipPreviousAsync()) ([bool])) }
            "seek" {
              $tl = $target.GetTimelineProperties()
              $ticks = [int64](($tl.StartTime.TotalSeconds + [double]$cmd.seconds) * 10000000)
              [void](Await-WinRT ($target.TryChangePlaybackPositionAsync($ticks)) ([bool]))
            }
          }
        }
      } catch { Log ("cmd " + $_.Exception.Message) }
    }
    $session = Pick-Session $mgr
    if (-not $session) {
      Write-Status '{"live":false}'
    } else {
      $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $info = $session.GetPlaybackInfo()
      $tl = $session.GetTimelineProperties()
      $start = 0
      $end = 0
      $pos = 0
      try { $start = $tl.StartTime.TotalSeconds } catch {}
      try { $end = $tl.EndTime.TotalSeconds } catch {}
      try { $pos = $tl.Position.TotalSeconds - $start } catch {}
      if ($pos -lt 0) { $pos = 0 }
      $dur = [math]::Round($end - $start, 2)
      if ($dur -lt 0) { $dur = 0 }
      $title = ""
      $artist = ""
      try { $title = [string]$props.Title } catch {}
      try { $artist = [string]$props.Artist } catch {}
      $key = "$title|$artist"
      $art = ""
      if ($props -and $props.Thumbnail -and $key -ne $artKey -and $key -ne "|") {
        try {
          $ras = Await-WinRT ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
          if ($ras) {
            $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStream($ras)
            $copy = New-Object System.IO.MemoryStream
            $net.CopyTo($copy)
            $bytes = $copy.ToArray()
            if ($bytes.Length -gt 8 -and $bytes.Length -lt 300000) {
              $mime = "image/jpeg"
              if ($bytes[0] -eq 137) { $mime = "image/png" }
              $art = "data:" + $mime + ";base64," + [Convert]::ToBase64String($bytes)
            }
          }
          $artKey = $key
        } catch {
          Log ("art " + $_.Exception.Message)
        }
      }
      $playing = ([string]$info.PlaybackStatus -eq "Playing")
      $obj = [ordered]@{
        live = $true
        title = $title
        artist = $artist
        source = (Pretty ([string]$session.SourceAppUserModelId))
        playing = $playing
        position = [math]::Round($pos, 2)
        duration = $dur
        art = $art
      }
      Write-Status ($obj | ConvertTo-Json -Compress)
    }
  } catch {
    Log $_.Exception.Message
    $script:manager = $null
    Write-Status '{"live":false}'
  }
  Start-Sleep -Milliseconds 700
}
