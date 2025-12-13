const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  getUserList: (token,khName,khUsername,userType,pageSize,pageNum,khPhone) => ipcRenderer.invoke('get_user_list', token,khName,khUsername,userType,pageSize,pageNum,khPhone),
  openMainWindow: (data) => ipcRenderer.send('open-main-window', data),
  openUserListWindow: (data) => ipcRenderer.send('open-user-list-window', data),
  logout: () => ipcRenderer.send('logout'),
  closeWindow: () => ipcRenderer.send('close-window'),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('move-window', deltaX, deltaY),
  setUserData: (callback) => ipcRenderer.on('set-user-data', callback),
  // getCookies: (domain) => ipcRenderer.invoke('get-cookies', domain),
  setCookies: (params) => ipcRenderer.invoke('set-cookies', params),
  clearCookies: (params) => ipcRenderer.invoke('clear-cookies', params),
  getAccountCookies: (params) => ipcRenderer.invoke('get-account-cookies', params),
  getAgentCookies: () => ipcRenderer.invoke('get-agent-cookies'),
  // getCookies: (domain) => ipcRenderer.invoke('get-cookies', domain),
  getCookies: (domain, partition = null) => partition 
  ? ipcRenderer.invoke('get-cookies', domain, partition)
  : ipcRenderer.invoke('get-cookies', domain),
  migrateCookies: (data) => ipcRenderer.invoke('migrate-cookies', data),
  getAllCookies: (domain) => ipcRenderer.invoke('get-all-cookies', domain),
  // setCookie: () => ipcRenderer.invoke('set-cookie'),
  saveCookies: (data) => ipcRenderer.invoke('save-cookies', data),
  showMessage: (options) => ipcRenderer.invoke('show-message', options),
  saveUserCookies: (data) => ipcRenderer.invoke('save_user_cookies', data),
  checkUserCookies: (data) => ipcRenderer.invoke('check_user_cookies', data),
  setWebViewUserAgent: (userAgent) => ipcRenderer.send('set-webview-ua', userAgent),
  openUrlInNewWindow: (data) => ipcRenderer.send('open-url-in-new-window', data),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onCheckingForUpdate: (callback) => ipcRenderer.on('checking-for-update', callback),
  restartToUpdate: () => ipcRenderer.send('restart-to-update'),
  getMenuIsAuth: (data) => ipcRenderer.invoke('getMenuIsAuth', data),

  getAccountStatus: (data) => ipcRenderer.invoke('get-account-status', data),
  unbindAccount: (data) => ipcRenderer.invoke('unbind-account', data),
  clearAccountCookies: (data) => ipcRenderer.invoke('clear-account-cookies', data),
  setAccountCookiesFromServer: (data) => ipcRenderer.invoke('set-account-cookies-from-server', data),

  // 浏览器相关 API
  openBrowser: () => ipcRenderer.send('open-browser'),
  openUrlInBrowser: (url) => ipcRenderer.send('open-url-in-browser', url),
  onNavigateToUrl: (callback) => ipcRenderer.on('navigate-to-url', callback),

  // 修复：添加 enterWebview 函数
  enterWebview: (data) => ipcRenderer.send('enter-webview', data),
  checkBlueVPackage: (userId) => ipcRenderer.invoke('check-bluev-package', userId)

});
