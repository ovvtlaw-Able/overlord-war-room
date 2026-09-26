param([int]$OffsetX = 16, [int]$OffsetY = 16, [int]$CellSize = 4, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
if ($CellSize -lt 2 -or $CellSize -gt 16 -or $OffsetX -lt 0 -or $OffsetY -lt 0) { throw 'Invalid panel geometry' }
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
public static class OverlordPanelReader {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out Rect rect);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref Point point);
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    public static void Init() { SetProcessDPIAware(); }
    public static string Read(int x, int y, int cell) {
        IntPtr window = GetForegroundWindow(); uint pid;
        GetWindowThreadProcessId(window, out pid);
        string name;
        try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { return null; }
        if (!name.Equals("Wow", StringComparison.OrdinalIgnoreCase) && !name.Equals("WowClassic", StringComparison.OrdinalIgnoreCase) && !name.Equals("WowB", StringComparison.OrdinalIgnoreCase) && !name.Equals("WowT", StringComparison.OrdinalIgnoreCase)) return null;
        Rect rect;
        if (!GetClientRect(window, out rect) || x+64*cell>rect.Right || y+32*cell>rect.Bottom) return null;
        Point origin = new Point(x,y);
        if (!ClientToScreen(window,ref origin)) return null;
        using (Bitmap bitmap = new Bitmap(64*cell,32*cell)) {
            using (Graphics graphics = Graphics.FromImage(bitmap)) {
                graphics.CopyFromScreen(origin.X,origin.Y,0,0,bitmap.Size,CopyPixelOperation.SourceCopy);
            }
            byte[] bytes = new byte[768]; int bit=0;
            for(int i=0;i<2048;i++) {
                Color c=bitmap.GetPixel((i%64)*cell+cell/2,(i/64)*cell+cell/2);
                int[] channels={c.R,c.G,c.B};
                foreach(int channel in channels) {
                    if(channel>127) bytes[bit/8] |= (byte)(1 << (7-bit%8));
                    bit++;
                }
            }
            return Convert.ToBase64String(bytes);
        }
    }
}
'@ -ReferencedAssemblies System.Drawing
if ($ValidateOnly) { Write-Output 'Windows capture helper compiled; capture not started.'; return }
[OverlordPanelReader]::Init()
while ($true) {
    try {
        $packet = [OverlordPanelReader]::Read($OffsetX, $OffsetY, $CellSize)
        if ($packet) { [Console]::Out.WriteLine($packet); [Console]::Out.Flush() }
    } catch { [Console]::Error.WriteLine('Panel capture unavailable; retrying.') }
    Start-Sleep -Milliseconds 60
}
