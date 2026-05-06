const { app, BrowserWindow, ipcMain, screen } = require('electron');

// Force software rendering to fix the "vector index out of bounds" and GPU crashes
// This is necessary for stable transparent windows on many Windows GPU drivers
app.disableHardwareAcceleration();

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

    // Handle custom dragging from renderer pointer coordinates (mouse + touch)
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    function beginDragAtScreenPoint(point) {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        const winPos = mainWindow.getPosition();
        dragOffset = {
            x: point.x - winPos[0],
            y: point.y - winPos[1]
        };
        isDragging = true;
    }

    ipcMain.on('start-drag-at', (_event, point) => {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
            return;
        }
        beginDragAtScreenPoint(point);
    });

    // Backward compatibility with old renderer behavior
    ipcMain.on('start-drag', () => {
        const mousePos = screen.getCursorScreenPoint();
        beginDragAtScreenPoint({ x: mousePos.x, y: mousePos.y });
    });

    ipcMain.on('drag-to', (_event, point) => {
        if (!isDragging || !mainWindow || mainWindow.isDestroyed()) {
            return;
        }
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
            return;
        }

        mainWindow.setPosition(
            Math.round(point.x - dragOffset.x),
            Math.round(point.y - dragOffset.y)
        );
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
