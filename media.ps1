$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
})[0]
function Await-WinRT($op, $type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  if (-not $task.Wait(1000)) { throw "timeout" }
  return $task.Result
}
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$cmdPath = Join-Path $env:TEMP "lumen-cmd.json"
$artPath = Join-Path $env:TEMP "lumen-art.img"
$artKey = ""

function Pretty([string]$id) {
  if ($id -match "Spotify") { return "Spotify" }
  if ($id -match "Yandex|yandex") { return "Яндекс Музыка" }
  if ($id -match "chrome") { return "Chrome" }
  if ($id -match "msedge") { return "Edge" }
  if ($id -match "AIMP") { return "AIMP" }
  if ($id -match "vlc") { return "VLC" }
  return "Плеер"
}

while ($true) {
  try {
    if (Test-Path $cmdPath) {
      $cmd = Get-Content -Raw -Path $cmdPath | ConvertFrom-Json
      Remove-Item $cmdPath -Force
      $mgr = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
      $session = $mgr.GetCurrentSession()
      if ($session) {
        switch ([string]$cmd.op) {
          "play" { [void](Await-WinRT ($session.TryTogglePlayPauseAsync()) ([bool])) }
          "next" { [void](Await-WinRT ($session.TrySkipNextAsync()) ([bool])) }
          "prev" { [void](Await-WinRT ($session.TrySkipPreviousAsync()) ([bool])) }
          "seek" {
            $tl = $session.GetTimelineProperties()
            $ticks = [int64](($tl.StartTime.TotalSeconds + [double]$cmd.seconds) * 10000000)
            [void](Await-WinRT ($session.TryChangePlaybackPositionAsync($ticks)) ([bool]))
          }
        }
      }
    }
    $mgr = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $session = $mgr.GetCurrentSession()
    if (-not $session) {
      '{"live":false}'
    } else {
      $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $info = $session.GetPlaybackInfo()
      $tl = $session.GetTimelineProperties()
      $start = $tl.StartTime.TotalSeconds
      $dur = [math]::Round($tl.EndTime.TotalSeconds - $start, 2)
      $pos = [math]::Round($tl.Position.TotalSeconds - $start, 2)
      if ($pos -lt 0) { $pos = 0 }
      $key = "$($props.Title)|$($props.Artist)"
      $sendArt = $false
      if ($props.Thumbnail -and $key -ne $artKey) {
        $ras = Await-WinRT ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStream($ras)
        $copy = New-Object System.IO.MemoryStream
        $net.CopyTo($copy)
        [IO.File]::WriteAllBytes($artPath, $copy.ToArray())
        $artKey = $key
        $sendArt = $true
      }
      $art = ""
      if ($sendArt -and (Test-Path $artPath)) {
        $bytes = [IO.File]::ReadAllBytes($artPath)
        if ($bytes.Length -gt 8 -and $bytes.Length -lt 500000) {
          $mime = "image/jpeg"
          if ($bytes[0] -eq 137) { $mime = "image/png" }
          $art = "data:" + $mime + ";base64," + [Convert]::ToBase64String($bytes)
        }
      }
      [ordered]@{
        live = $true
        title = [string]$props.Title
        artist = [string]$props.Artist
        source = (Pretty ([string]$session.SourceAppUserModelId))
        playing = ([string]$info.PlaybackStatus -eq "Playing")
        position = $pos
        duration = $dur
        art = $art
      } | ConvertTo-Json -Compress
    }
  } catch {
    '{"live":false}'
  }
  Start-Sleep -Milliseconds 1000
}
