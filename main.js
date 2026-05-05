const { app, BrowserWindow, ipcMain, screen } = require('electron');

// app.disableHardwareAcceleration(); // Uncomment this if the app still crashes

// Add stability flags for GPU issues common on some Windows setups
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('use-angle', 'd3d11');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 200,
        height: 200,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    
    // Set initial position (bottom right)
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(width - 250, height - 250);

    // Global mouse tracking loop
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
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

    // Handle pixel-perfect click-through
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            win.setIgnoreMouseEvents(ignore, options);
        }
    });

    // Handle custom dragging
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    ipcMain.on('start-drag', (event) => {
        isDragging = true;
        const mousePos = screen.getCursorScreenPoint();
        const winPos = mainWindow.getPosition();
        dragOffset = {
            x: mousePos.x - winPos[0],
            y: mousePos.y - winPos[1]
        };
        
        const dragInterval = setInterval(() => {
            if (!isDragging || mainWindow.isDestroyed()) {
                clearInterval(dragInterval);
                return;
            }
            const currentMousePos = screen.getCursorScreenPoint();
            mainWindow.setPosition(
                currentMousePos.x - dragOffset.x,
                currentMousePos.y - dragOffset.y
            );
        }, 16);
    });

    ipcMain.on('stop-drag', () => {
        isDragging = false;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
