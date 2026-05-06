const { app, BrowserWindow, ipcMain, screen, Menu, Tray, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// Force software rendering to fix the "vector index out of bounds" and GPU crashes
app.disableHardwareAcceleration();

let mainWindow;
let tray;
let hideTimeout;

function createTray() {
    tray = new Tray(path.join(__dirname, 'duck.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Duck', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('Desktop Duck');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

function getContextMenu() {
    return Menu.buildFromTemplate([
        {
            label: 'Autostart with Windows',
            type: 'checkbox',
            checked: app.getLoginItemSettings().openAtLogin,
            click: (item) => {
                app.setLoginItemSettings({
                    openAtLogin: item.checked,
                    path: app.getPath('exe')
                });
            }
        },
        {
            label: 'Hide for...',
            submenu: [
                { label: '5 minutes', click: () => hideDuck(5) },
                { label: '15 minutes', click: () => hideDuck(15) },
                { label: '30 minutes', click: () => hideDuck(30) },
                { label: '1 hour', click: () => hideDuck(60) }
            ]
        },
        { label: 'Minimize to Tray', click: () => mainWindow.hide() },
        { label: 'Source Code', click: () => shell.openExternal('https://github.com/Abdelaal251-onspec/desktop-duck') },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
}

function hideDuck(minutes) {
    if (mainWindow) {
        mainWindow.hide();
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
            }
        }, minutes * 60000);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 200,
        height: 200,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(width - 250, height - 250);

    mainWindow.webContents.on('context-menu', () => {
        getContextMenu().popup(mainWindow);
    });

    // Global mouse tracking loop
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
            const mousePos = screen.getCursorScreenPoint();
            const winPos = mainWindow.getPosition();
            mainWindow.webContents.send('global-mouse-update', {
                x: mousePos.x,
                y: mousePos.y,
                winX: winPos[0],
                winY: winPos[1]
            });
        }
    }, 16);

    // Advanced Caret/Active window tracking
    // We use a more comprehensive PowerShell script to find the actual blinking caret
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
            const psCommand = `
                $Signature = @'
                using System;
                using System.Runtime.InteropServices;
                public class Win32 {
                    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
                    [StructLayout(LayoutKind.Sequential)] public struct GUITHREADINFO { 
                        public int cbSize; public int flags; public IntPtr hAct; public IntPtr hFoc; 
                        public IntPtr hCap; public IntPtr hMenu; public IntPtr hMove; public IntPtr hCar; public RECT rc; 
                    }
                    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
                    [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint id, ref GUITHREADINFO info);
                    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
                    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
                    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
                }
'@
                Add-Type -TypeDefinition $Signature
                $info = New-Object Win32+GUITHREADINFO
                $info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
                if ([Win32]::GetGUIThreadInfo(0, [ref]$info) -and $info.hCar -ne 0) {
                    $pt = New-Object Win32+POINT
                    $pt.x = $info.rc.L; $pt.y = $info.rc.T
                    [Win32]::ClientToScreen($info.hCar, [ref]$pt)
                    echo "CARET $($pt.x) $($pt.y)"
                } else {
                    $fg = [Win32]::GetForegroundWindow()
                    $rect = New-Object Win32+RECT
                    if ([Win32]::GetWindowRect($fg, [ref]$rect)) {
                        $cx = ($rect.L + $rect.R) / 2
                        $cy = ($rect.T + $rect.B) / 2
                        echo "WIN $cx $cy"
                    }
                }
            `.replace(/\n/g, ' ').trim();

            exec(`powershell -Command "${psCommand}"`, (err, stdout) => {
                if (!err && stdout && mainWindow && !mainWindow.isDestroyed()) {
                    const line = stdout.trim().split('\n')[0];
                    const parts = line.split(' ');
                    if (parts.length === 3) {
                        mainWindow.webContents.send('typing-update', {
                            type: parts[0],
                            x: parseFloat(parts[1]),
                            y: parseFloat(parts[2])
                        });
                    }
                }
            });
        }
    }, 500); // Check every 500ms for active typing position

    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, options);
    });

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    ipcMain.on('start-drag-at', (_event, point) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const winPos = mainWindow.getPosition();
        dragOffset = { x: point.x - winPos[0], y: point.y - winPos[1] };
        isDragging = true;
    });

    ipcMain.on('drag-to', (_event, point) => {
        if (!isDragging || !mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.setPosition(Math.round(point.x - dragOffset.x), Math.round(point.y - dragOffset.y));
    });

    ipcMain.on('stop-drag', () => { isDragging = false; });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
