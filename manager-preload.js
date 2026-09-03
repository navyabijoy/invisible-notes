const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manager', {
  list: () => ipcRenderer.invoke('manager:list'),
  open: (id) => ipcRenderer.send('manager:open', id),
  hide: (id) => ipcRenderer.send('manager:hide', id),
  delete: (id) => ipcRenderer.send('manager:delete', id),
  rename: (id, title) => ipcRenderer.send('manager:rename', { id, title }),
  newNote: () => ipcRenderer.send('manager:new'),
  onChanged: (cb) => ipcRenderer.on('manager:notesChanged', (e, snapshot) => cb(snapshot)),
  version: () => ipcRenderer.invoke('manager:version'),
  // Shortcut legend (issue #20)
  shortcuts: () => ipcRenderer.invoke('manager:shortcuts'),
  onShowShortcuts: (cb) => ipcRenderer.on('manager:showShortcuts', () => cb()),
  // Workspaces (issue #8)
  setWorkspace: (id) => ipcRenderer.send('manager:setWorkspace', id),
  createWorkspace: (name) => ipcRenderer.send('manager:createWorkspace', name),
  renameWorkspace: (id, name) => ipcRenderer.send('manager:renameWorkspace', { id, name }),
  deleteWorkspace: (id) => ipcRenderer.send('manager:deleteWorkspace', id),
  moveNote: (id, workspaceId) => ipcRenderer.send('manager:moveNote', { id, workspaceId })
});
