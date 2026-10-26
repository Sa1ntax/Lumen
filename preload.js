const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumen", {
  setFrame: (w, h) => ipcRenderer.send("frame", { w, h }),
  onMedia: (cb) => ipcRenderer.on("media", (_event, data) => cb(data)),
  onHover: (cb) => ipcRenderer.on("hover", (_event, over) => cb(Boolean(over))),
  command: (op, seconds) => ipcRenderer.send("media-cmd", { op, seconds: seconds || 0 }),
});
