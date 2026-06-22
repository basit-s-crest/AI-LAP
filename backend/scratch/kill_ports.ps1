$ports = @(3000, 4000, 5000, 8001)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess) {
            $pidToKill = $conn.OwningProcess
            try {
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                Write-Host "Killed process $pidToKill on port $port"
            } catch {
                Write-Host "Failed to kill process $pidToKill on port $port"
            }
        }
    }
}
