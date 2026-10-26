const { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

let win = null;
let tray = null;
let mediaProc = null;
let lastW = 0;
let lastH = 0;
let lastMedia = "";
let lastOver = false;

function sendMedia(raw) {
  if (!win || !raw) return;
  const text = String(raw).replace(/^\uFEFF/, "").trim();
  if (!text.startsWith("{") || text === lastMedia) return;
  try {
    const data = JSON.parse(text);
    lastMedia = text;
    win.webContents.send("media", data);
  } catch {
    /* bad line */
  }
}

function startMedia() {
  if (process.platform !== "win32") return;
  const mediaFile = path.join(os.tmpdir(), "lumen-media.json");
  const script = path.join(__dirname, "media.ps1");
  mediaProc = spawn(
    "powershell.exe",
    ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", script],
    { windowsHide: true },
  );
  mediaProc.on("error", (err) => {
    console.error("media spawn error", err);
  });
  mediaProc.stderr.on("data", (d) => {
    console.error("media stderr", d.toString());
  });
  let buf = Buffer.alloc(0);
  mediaProc.stdout.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const utf8 = buf.indexOf(10);
      const utf16 = buf.indexOf(Buffer.from([13, 0, 10, 0]));
      const cut = utf16 >= 0 && (utf8 < 0 || utf16 < utf8) ? utf16 : utf8;
      if (cut < 0) break;
      const slice = buf.subarray(0, cut);
      const step = cut === utf16 ? 4 : 1;
      buf = buf.subarray(cut + step);
      const text = slice.includes(0) ? slice.toString("utf16le") : slice.toString("utf8");
      sendMedia(text);
    }
  });
  setInterval(() => {
    try {
      const raw = fs.readFileSync(mediaFile, "utf8");
      sendMedia(raw);
    } catch {
      /* not written yet */
    }
  }, 600);
}

function fit(width, height) {
  if (!win) return;
  const w = Math.max(48, Math.ceil(width) + 8);
  const h = Math.max(32, Math.ceil(height) + 8);
  if (w === lastW && h === lastH) return;
  const area = screen.getPrimaryDisplay().workArea;
  const x = Math.round(area.x + (area.width - w) / 2);
  const y = area.y + 6;
  win.setBounds({ x, y, width: w, height: h });
  lastW = w;
  lastH = h;
}

function startHoverPoll() {
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const b = win.getBounds();
    const over =
      cursor.x >= b.x &&
      cursor.x <= b.x + b.width &&
      cursor.y >= b.y &&
      cursor.y <= b.y + b.height;
    if (over !== lastOver) {
      lastOver = over;
      win.webContents.send("hover", over);
      if (over) {
        win.setIgnoreMouseEvents(false);
      } else {
        win.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, 80);
}

function createWindow() {
  win = new BrowserWindow({
    width: 260,
    height: 56,
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
    win.setIgnoreMouseEvents(true, { forward: true });
    win.show();
    startHoverPoll();
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
    if (win) win.show();
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
    });
    tray.on("right-click", () => tray.setContextMenu(trayMenu()));
    startMedia();
  });
}

ipcMain.on("media-cmd", (_event, payload) => {
  fs.writeFileSync(path.join(os.tmpdir(), "lumen-cmd.json"), JSON.stringify(payload || {}));
});

ipcMain.on("frame", (_event, size) => {
  if (!size) return;
  fit(Number(size.w) || 200, Number(size.h) || 48);
});

app.on("before-quit", () => {
  if (mediaProc) mediaProc.kill();
});

app.on("window-all-closed", () => {
  // Трей остаётся. Выход только из меню трея.
});
