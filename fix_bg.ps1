$file = 'd:\JaiKraJokNECTEC\client\src\App.tsx'
$content = Get-Content $file -Raw -Encoding UTF8

# Fix Tailwind opacity classes
$content = $content -replace 'bg-white/90', 'bg-white'
$content = $content -replace 'bg-white/95', 'bg-white'

# Fix inline style semi-transparent whites
$content = $content -replace '"rgba\(255,255,255,0\.85\)"', '"#ffffff"'
$content = $content -replace '"rgba\(255,255,255,0\.9\)"', '"#ffffff"'
$content = $content -replace '"rgba\(255,255,255,0\.92\)"', '"#ffffff"'
$content = $content -replace '"rgba\(255,255,255,0\.95\)"', '"#ffffff"'

Set-Content $file $content -Encoding UTF8
Write-Host "Done!"
