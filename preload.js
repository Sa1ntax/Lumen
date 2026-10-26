const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumen", {
  setInteractive: (on) => ipcRenderer.send("interactive", Boolean(on)),
  onMedia: (cb) => ipcRenderer.on("media", (_event, data) => cb(data)),
  command: (op, seconds) => ipcRenderer.send("media-cmd", { op, seconds: seconds || 0 }),
});
