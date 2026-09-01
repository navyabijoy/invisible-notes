const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manager', {
  list: () => ipcRenderer.invoke('manager:list'),
  open: (id) => ipcRenderer.send('manager:open', id),
  hide: (id) => ipcRenderer.send('manager:hide', id),
  delete: (id) => ipcRenderer.send('manager:delete', id),
  rename: (id, title) => ipcRenderer.send('manager:rename', { id, title }),
  newNote: () => ipcRenderer.send('manager:new'),
  onChanged: (cb) => ipcRenderer.on('manager:notesChanged', (e, notes) => cb(notes)),
  version: () => ipcRenderer.invoke('manager:version'),
  shortcuts: () => ipcRenderer.invoke('manager:shortcuts'),
  onShowShortcuts: (cb) => ipcRenderer.on('manager:showShortcuts', () => cb())
});
