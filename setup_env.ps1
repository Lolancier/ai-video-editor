# Setup Environment Script
# Usage: . .\setup_env.ps1

Write-Host "Configuring environment..." -ForegroundColor Cyan

$NodePath = "C:\Program Files\nodejs"
if (Test-Path $NodePath) {
    $env:PATH = "$NodePath;$env:PATH"
    Write-Host "Node.js added to PATH" -ForegroundColor Green
}

$PythonPath = "C:\Users\Asus\AppData\Local\Programs\Python\Python311"
if (Test-Path $PythonPath) {
    $env:PATH = "$PythonPath;$PythonPath\Scripts;$env:PATH"
    Write-Host "Python added to PATH" -ForegroundColor Green
}

try {
    Write-Host "Node: $(node --version)"
    Write-Host "Python: $(python --version)"
    Write-Host "Pip: $(pip --version)"
} catch {
    Write-Host "Error checking versions" -ForegroundColor Red
}

Write-Host "Environment configured." -ForegroundColor Cyan
