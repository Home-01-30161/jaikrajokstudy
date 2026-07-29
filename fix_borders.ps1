$file = 'd:\JaiKraJokNECTEC\client\src\App.tsx'
$content = Get-Content $file -Raw -Encoding UTF8

# Make card borders darker and add shadow to distinguish from background
# Change light border to a more visible border
$content = $content -replace 'rounded-3xl bg-white border-2 border-\[#e0d8cc\]', 'rounded-3xl bg-white border border-[#c8bfb2] shadow-md'
$content = $content -replace 'rounded-2xl bg-white border-2 border-\[#e0d8cc\]', 'rounded-2xl bg-white border border-[#c8bfb2] shadow-sm'
$content = $content -replace 'rounded-3xl bg-white border-2 border-\[#e0d8cc\] flex flex-col', 'rounded-3xl bg-white border border-[#c8bfb2] shadow-md flex flex-col'
$content = $content -replace 'rounded-3xl bg-white border-2 border-\[#e0d8cc\] space-y-4', 'rounded-3xl bg-white border border-[#c8bfb2] shadow-md space-y-4'
$content = $content -replace 'rounded-3xl bg-white border-2 border-\[#e0d8cc\] space-y-3', 'rounded-3xl bg-white border border-[#c8bfb2] shadow-md space-y-3'
$content = $content -replace 'rounded-3xl bg-white border-2 border-\[#e0d8cc\] flex items-center', 'rounded-3xl bg-white border border-[#c8bfb2] shadow-sm flex items-center'

# Hero card
$content = $content -replace 'p-8 rounded-3xl bg-white border-2 border-\[#e0d8cc\] shadow-sm', 'p-8 rounded-3xl bg-white border border-[#c8bfb2] shadow-md'

# Mode cards
$content = $content -replace 'bg-white border-2 border-\[#e0d8cc\] hover:border-\[#2D6A6F\]', 'bg-white border border-[#c8bfb2] shadow-sm hover:border-[#2D6A6F] hover:shadow-md'

# Channel card
$content = $content -replace 'bg-white border-2 border-\[#e0d8cc\] flex flex-col sm:flex-row', 'bg-white border border-[#c8bfb2] shadow-sm flex flex-col sm:flex-row'

Set-Content $file $content -Encoding UTF8
Write-Host "Done!"
