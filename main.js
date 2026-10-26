const { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const WINDOW = { width: 980, height: 340 };
let win = null;
let tray = null;
let mediaProc = null;

function startMedia() {
  if (process.platform !== "win32") return;
  mediaProc = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "media.ps1")],
    { windowsHide: true },
  );
  let buf = "";
  mediaProc.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("{") || !win) continue;
      try {
        win.webContents.send("media", JSON.parse(line));
      } catch {
        /* ignore a partial line */
      }
    }
  });
}

function position() {
  if (!win) return;
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const x = Math.round(area.x + (area.width - WINDOW.width) / 2);
  const y = area.y + 8;
  win.setBounds({ x, y, width: WINDOW.width, height: WINDOW.height });
}

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => {
    position();
    win.show();
  });
  win.on("closed", () => {
    win = null;
  });
}

function trayMenu() {
  const login = app.getLoginItemSettings();
  return Menu.buildFromTemplate([
    {
      label: "Показать остров",
      click: () => {
        if (!win) createWindow();
        win.show();
        position();
      },
    },
    {
      label: "Запускать вместе с Windows",
      type: "checkbox",
      checked: login.openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },
    { label: "Выход", click: () => app.quit() },
  ]);
}

app.setAppUserModelId("lumen.island");

const locked = app.requestSingleInstanceLock();
if (!locked) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      win.show();
      position();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    const icon = nativeImage.createFromPath(path.join(__dirname, "renderer", "icon.png"));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip("Lumen");
    tray.setContextMenu(trayMenu());
    tray.on("click", () => {
      if (!win) createWindow();
      win.show();
      position();
    });
    tray.on("right-click", () => tray.setContextMenu(trayMenu()));
    screen.on("display-metrics-changed", position);
    startMedia();
  });
}

ipcMain.on("media-cmd", (_event, payload) => {
  fs.writeFileSync(path.join(os.tmpdir(), "lumen-cmd.json"), JSON.stringify(payload || {}));
});

ipcMain.on("interactive", (_event, on) => {
  if (!win) return;
  if (on) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

app.on("before-quit", () => {
  if (mediaProc) mediaProc.kill();
});

app.on("window-all-closed", () => {
  // Трей остаётся. Выход только из меню трея.
});
