Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }
function Await($asyncOp, $type) {
  $asTask = $asTaskGeneric.MakeGenericMethod($type)
  $netTask = $asTask.Invoke($null, @($asyncOp))
  $netTask.Wait(-1) | Out-Null
  return $netTask.Result
}
[Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('tr-TR'))
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }

$fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync('C:\Users\emirh\Desktop\çift\couples-app-mobile\scripts\top_test.png')
$file = Await $fileOp ([Windows.Storage.StorageFile])
$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$stream = Await $streamOp ([Windows.Storage.Streams.IRandomAccessStream])
$decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoder = Await $decoderOp ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmapOp = $decoder.GetSoftwareBitmapAsync()
$bitmap = Await $bitmapOp ([Windows.Graphics.Imaging.SoftwareBitmap])
$recogOp = $engine.RecognizeAsync($bitmap)
$result = Await $recogOp ([Windows.Media.Ocr.OcrResult])
$result.Lines | ForEach-Object { Write-Host ($_.Rect.X.ToString() + ',' + $_.Rect.Y.ToString() + ' : ' + $_.Text) }

