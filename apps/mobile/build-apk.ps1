$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidDir = Join-Path $mobileRoot "android"
$gradle = Join-Path $env:USERPROFILE ".gradle\wrapper\dists\gradle-9.3.1-bin\23ovyewtku6u96viwx3xl3oks\gradle-9.3.1\bin\gradle.bat"
$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "PeopleOS.apk"

if (-not (Test-Path $gradle)) {
  throw "Gradle 9.3.1 is missing at $gradle. Do not switch to Gradle 9.4.1."
}
if (-not (Test-Path $androidDir)) {
  throw "Android project is missing. From apps/mobile run: npx expo prebuild --platform android"
}

$env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle"
$env:EXPO_PUBLIC_API_URL = "https://peopleos-api.vercel.app/api/v1"
$env:CI = "1"

Push-Location $androidDir
try {
  & $gradle --gradle-user-home $env:GRADLE_USER_HOME assembleRelease
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}

Copy-Item $apk $desktop -Force
Get-Item $desktop | Select-Object FullName, Length, LastWriteTime
