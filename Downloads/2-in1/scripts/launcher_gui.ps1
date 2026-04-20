Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO_ROOT = Split-Path -Parent $SCRIPT_DIR
$BACKEND_DIR = Join-Path $REPO_ROOT "backend\p2"
$FRONTEND_DIR = Join-Path $REPO_ROOT "frontend\m3"
$VENV_DIR = Join-Path $BACKEND_DIR "venv"
$BACKEND_PORT = 5000
$FRONTEND_PORT = 5173

$backendProcess = $null
$frontendProcess = $null
$backendRuntimePort = $BACKEND_PORT
$frontendRuntimePort = $FRONTEND_PORT

function Test-PortInUse {
    param([int]$Port)

    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return ($listeners.Port -contains $Port)
}

function Get-FreePortSuggestion {
    param([int]$StartPort)

    for ($port = $StartPort; $port -le ($StartPort + 20); $port++) {
        if (-not (Test-PortInUse -Port $port)) {
            return $port
        }
    }

    return $null
}

function Write-Log {
    param([string]$Message)

    $timestamp = (Get-Date).ToString("HH:mm:ss")
    $logBox.AppendText("[$timestamp] $Message`r`n")
    $logBox.SelectionStart = $logBox.Text.Length
    $logBox.ScrollToCaret()
}

function Ensure-BackendSetup {
    if (-not (Test-Path $VENV_DIR)) {
        Write-Log "Creando entorno virtual de Python..."
        python -m venv "$VENV_DIR"
    }

    if (Test-Path "$VENV_DIR\Scripts\python.exe") {
        $script:PYTHON = "$VENV_DIR\Scripts\python.exe"
        $script:PIP = "$VENV_DIR\Scripts\pip.exe"
    }
    else {
        $script:PYTHON = "$VENV_DIR\bin\python.exe"
        $script:PIP = "$VENV_DIR\bin\pip.exe"
    }

    Write-Log "Instalando dependencias backend..."
    & $script:PIP install -r "$BACKEND_DIR\requirements.txt"

    Write-Log "Verificando modelo de spaCy (es_core_news_sm)..."
    & $script:PYTHON -c "import spacy; spacy.load('es_core_news_sm')" *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Descargando modelo spaCy es_core_news_sm..."
        & $script:PYTHON -m spacy download es_core_news_sm
    }
}

function Ensure-FrontendSetup {
    if (-not (Test-Path "$FRONTEND_DIR\node_modules")) {
        Write-Log "Instalando dependencias frontend..."
        Push-Location "$FRONTEND_DIR"
        npm install
        Pop-Location
    }
}

function Update-Status {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        $backendStatusLabel.Text = "Backend: RUNNING (PID $($backendProcess.Id), Port $backendRuntimePort)"
        $backendStatusLabel.ForeColor = [System.Drawing.Color]::ForestGreen
    }
    else {
        $backendStatusLabel.Text = "Backend: STOPPED"
        $backendStatusLabel.ForeColor = [System.Drawing.Color]::Firebrick
    }

    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        $frontendStatusLabel.Text = "Frontend: RUNNING (PID $($frontendProcess.Id), Port $frontendRuntimePort)"
        $frontendStatusLabel.ForeColor = [System.Drawing.Color]::ForestGreen
    }
    else {
        $frontendStatusLabel.Text = "Frontend: STOPPED"
        $frontendStatusLabel.ForeColor = [System.Drawing.Color]::Firebrick
    }
}

function Start-Backend {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Write-Log "Backend ya está en ejecución."
        return
    }

    if (Test-PortInUse -Port $BACKEND_PORT) {
        $suggestedPort = Get-FreePortSuggestion -StartPort ($BACKEND_PORT + 1)
        if ($suggestedPort) {
            Write-Log "No se pudo iniciar backend: puerto $BACKEND_PORT ocupado. Sugerencia: liberar $BACKEND_PORT o usar $suggestedPort."
        }
        else {
            Write-Log "No se pudo iniciar backend: puerto $BACKEND_PORT ocupado."
        }
        return
    }

    Ensure-BackendSetup

    Write-Log "Iniciando backend en http://localhost:$BACKEND_PORT ..."

    $envVars = @(
        '$env:FLASK_DEBUG="true"',
        '$env:PORT="5000"',
        '$env:SETTINGS_ENCRYPTION_KEY="test_settings_encryption_key"',
        'python run.py'
    ) -join '; '

    $backendProcess = Start-Process -FilePath "powershell" `
        -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $envVars `
        -WorkingDirectory $BACKEND_DIR `
        -PassThru

    $script:backendRuntimePort = $BACKEND_PORT
    Write-Log "Backend iniciado (PID $($backendProcess.Id))."
    Update-Status
}

function Start-Frontend {
    param([switch]$AutoResolvePort)

    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Write-Log "Frontend ya está en ejecución."
        return
    }

    $launchPort = $FRONTEND_PORT
    if (Test-PortInUse -Port $launchPort) {
        $suggestedPort = Get-FreePortSuggestion -StartPort ($launchPort + 1)
        if ($AutoResolvePort -and $suggestedPort) {
            $launchPort = $suggestedPort
            Write-Log "Puerto $FRONTEND_PORT ocupado. Iniciando frontend automáticamente en $launchPort."
        }
        else {
            if ($suggestedPort) {
                Write-Log "No se pudo iniciar frontend: puerto $FRONTEND_PORT ocupado. Sugerencia: liberar $FRONTEND_PORT, usar $suggestedPort o pulsar 'Start Frontend (Auto)'."
            }
            else {
                Write-Log "No se pudo iniciar frontend: puerto $FRONTEND_PORT ocupado."
            }
            return
        }
    }

    Ensure-FrontendSetup

    Write-Log "Iniciando frontend en http://localhost:$launchPort ..."

    $frontendProcess = Start-Process -FilePath "powershell" `
        -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "npm run dev -- --port $launchPort" `
        -WorkingDirectory $FRONTEND_DIR `
        -PassThru

    $script:frontendRuntimePort = $launchPort
    Write-Log "Frontend iniciado (PID $($frontendProcess.Id))."
    Update-Status
}

function Stop-Backend {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Log "Backend detenido."
    }
    else {
        Write-Log "Backend ya estaba detenido."
    }

    $script:backendProcess = $null
    $script:backendRuntimePort = $BACKEND_PORT
    Update-Status
}

function Stop-Frontend {
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Log "Frontend detenido."
    }
    else {
        Write-Log "Frontend ya estaba detenido."
    }

    $script:frontendProcess = $null
    $script:frontendRuntimePort = $FRONTEND_PORT
    Update-Status
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "2-in-1 Launcher"
$form.Size = New-Object System.Drawing.Size(820, 620)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "Launcher local - 2-in-1"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(20, 15)
$form.Controls.Add($titleLabel)

$backendStatusLabel = New-Object System.Windows.Forms.Label
$backendStatusLabel.AutoSize = $true
$backendStatusLabel.Location = New-Object System.Drawing.Point(20, 55)
$form.Controls.Add($backendStatusLabel)

$frontendStatusLabel = New-Object System.Windows.Forms.Label
$frontendStatusLabel.AutoSize = $true
$frontendStatusLabel.Location = New-Object System.Drawing.Point(20, 80)
$form.Controls.Add($frontendStatusLabel)

$startAllButton = New-Object System.Windows.Forms.Button
$startAllButton.Text = "Start All"
$startAllButton.Size = New-Object System.Drawing.Size(120, 35)
$startAllButton.Location = New-Object System.Drawing.Point(20, 120)
$startAllButton.Add_Click({
    Start-Backend
    Start-Frontend -AutoResolvePort
})
$form.Controls.Add($startAllButton)

$stopAllButton = New-Object System.Windows.Forms.Button
$stopAllButton.Text = "Stop All"
$stopAllButton.Size = New-Object System.Drawing.Size(120, 35)
$stopAllButton.Location = New-Object System.Drawing.Point(150, 120)
$stopAllButton.Add_Click({
    Stop-Frontend
    Stop-Backend
})
$form.Controls.Add($stopAllButton)

$startBackendButton = New-Object System.Windows.Forms.Button
$startBackendButton.Text = "Start Backend"
$startBackendButton.Size = New-Object System.Drawing.Size(120, 35)
$startBackendButton.Location = New-Object System.Drawing.Point(20, 170)
$startBackendButton.Add_Click({ Start-Backend })
$form.Controls.Add($startBackendButton)

$stopBackendButton = New-Object System.Windows.Forms.Button
$stopBackendButton.Text = "Stop Backend"
$stopBackendButton.Size = New-Object System.Drawing.Size(120, 35)
$stopBackendButton.Location = New-Object System.Drawing.Point(150, 170)
$stopBackendButton.Add_Click({ Stop-Backend })
$form.Controls.Add($stopBackendButton)

$openBackendButton = New-Object System.Windows.Forms.Button
$openBackendButton.Text = "Open Backend"
$openBackendButton.Size = New-Object System.Drawing.Size(120, 35)
$openBackendButton.Location = New-Object System.Drawing.Point(280, 170)
$openBackendButton.Add_Click({ Start-Process "http://localhost:$BACKEND_PORT" })
$form.Controls.Add($openBackendButton)

$startFrontendButton = New-Object System.Windows.Forms.Button
$startFrontendButton.Text = "Start Frontend"
$startFrontendButton.Size = New-Object System.Drawing.Size(120, 35)
$startFrontendButton.Location = New-Object System.Drawing.Point(20, 220)
$startFrontendButton.Add_Click({ Start-Frontend })
$form.Controls.Add($startFrontendButton)

$startFrontendAutoButton = New-Object System.Windows.Forms.Button
$startFrontendAutoButton.Text = "Start Frontend (Auto)"
$startFrontendAutoButton.Size = New-Object System.Drawing.Size(150, 35)
$startFrontendAutoButton.Location = New-Object System.Drawing.Point(150, 220)
$startFrontendAutoButton.Add_Click({ Start-Frontend -AutoResolvePort })
$form.Controls.Add($startFrontendAutoButton)

$stopFrontendButton = New-Object System.Windows.Forms.Button
$stopFrontendButton.Text = "Stop Frontend"
$stopFrontendButton.Size = New-Object System.Drawing.Size(120, 35)
$stopFrontendButton.Location = New-Object System.Drawing.Point(310, 220)
$stopFrontendButton.Add_Click({ Stop-Frontend })
$form.Controls.Add($stopFrontendButton)

$openFrontendButton = New-Object System.Windows.Forms.Button
$openFrontendButton.Text = "Open Frontend"
$openFrontendButton.Size = New-Object System.Drawing.Size(120, 35)
$openFrontendButton.Location = New-Object System.Drawing.Point(440, 220)
$openFrontendButton.Add_Click({ Start-Process "http://localhost:$frontendRuntimePort" })
$form.Controls.Add($openFrontendButton)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = "Vertical"
$logBox.Font = New-Object System.Drawing.Font("Consolas", 10)
$logBox.Size = New-Object System.Drawing.Size(760, 300)
$logBox.Location = New-Object System.Drawing.Point(20, 270)
$form.Controls.Add($logBox)

$statusTimer = New-Object System.Windows.Forms.Timer
$statusTimer.Interval = 1000
$statusTimer.Add_Tick({ Update-Status })
$statusTimer.Start()

$form.Add_FormClosing({
    Stop-Frontend
    Stop-Backend
})

Update-Status
Write-Log "Launcher listo. Usa Start All para iniciar todos los servicios."
Write-Log "Frontend: http://localhost:$FRONTEND_PORT"
Write-Log "Backend: http://localhost:$BACKEND_PORT"

[void]$form.ShowDialog()
