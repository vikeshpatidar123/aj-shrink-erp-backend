$pids = @(9332, 3944, 10392, 8324)
foreach ($p in $pids) {
    try {
        Stop-Process -Id $p -Force -ErrorAction Stop
        Write-Host "Killed PID $p"
    } catch {
        Write-Host "PID $p not found or already dead"
    }
}
Write-Host ""
Write-Host "Checking ports 3000, 7070, 2425, 5040..."
netstat -ano | findstr "LISTENING" | findstr ":3000 :7070 :2425 :5040"
Write-Host "Done."
