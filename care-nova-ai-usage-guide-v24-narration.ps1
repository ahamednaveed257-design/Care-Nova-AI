param([string]$TextPath, [string]$AudioPath)
Add-Type -AssemblyName System.Speech
$text = (Get-Content -LiteralPath $TextPath -Raw).Trim()
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice('Microsoft Zira Desktop') } catch { }
$s.Rate = -3
$s.Volume = 100
$s.SetOutputToWaveFile($AudioPath)
$s.Speak($text)
$s.Dispose()