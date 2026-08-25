$port = 3000
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        if ($processId) {
            Write-Host "Killing process $processId on port $port"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "No process found on port $port"
}
Start-Sleep -Seconds 2
npx.cmd prisma generate
npx.cmd prisma db push
