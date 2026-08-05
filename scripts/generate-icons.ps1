Add-Type -AssemblyName System.Drawing

function New-ZeroCityIcon([int]$Size, [string]$OutputPath) {
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(6, 17, 19))

    $margin = [int]($Size * 0.12)
    $tile = [int](($Size - ($margin * 2)) / 4)
    $colors = @(
        [System.Drawing.Color]::FromArgb(53, 211, 189),
        [System.Drawing.Color]::FromArgb(236, 92, 137),
        [System.Drawing.Color]::FromArgb(240, 184, 79),
        [System.Drawing.Color]::FromArgb(102, 141, 255)
    )
    $positions = @(
        @(0,0),@(1,0),@(2,0),@(3,0),@(3,1),@(3,2),
        @(3,3),@(2,3),@(1,3),@(0,3),@(0,2),@(0,1)
    )

    for ($index = 0; $index -lt $positions.Count; $index++) {
        $x = $margin + ($positions[$index][0] * $tile)
        $y = $margin + ($positions[$index][1] * $tile)
        $brush = New-Object System.Drawing.SolidBrush($colors[$index % 4])
        $graphics.FillRectangle($brush, $x + 2, $y + 2, $tile - 4, $tile - 4)
        $brush.Dispose()
    }

    $centerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 31, 33))
    $graphics.FillRectangle($centerBrush, $margin + $tile, $margin + $tile, $tile * 2, $tile * 2)
    $centerBrush.Dispose()

    $fontSize = [float]($Size * 0.17)
    $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(244, 240, 223))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $center = New-Object System.Drawing.RectangleF(($margin + $tile), ($margin + $tile), ($tile * 2), ($tile * 2))
    $graphics.DrawString('ZC', $font, $textBrush, $center, $format)

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$publicDirectory = Resolve-Path (Join-Path $PSScriptRoot '..\public')
New-ZeroCityIcon 192 (Join-Path $publicDirectory 'icon-192.png')
New-ZeroCityIcon 512 (Join-Path $publicDirectory 'icon-512.png')
