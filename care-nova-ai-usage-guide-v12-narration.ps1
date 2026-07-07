param([string]$TextPath, [string]$AudioPath)
Add-Type -AssemblyName System.Speech
$text = Get-Content -LiteralPath $TextPath -Raw
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice('Microsoft Zira Desktop') } catch { }
$s.Rate = -2
$s.Volume = 92
$s.SetOutputToWaveFile($AudioPath)
$s.Speak($text)
$s.Dispose()