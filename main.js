const { app, BrowserWindow, ipcMain, session, guestView, dialog, Menu } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');
const axios = require('axios');
const { version } = require('./package.json');
const { autoUpdater } = require('electron-updater');

// Windows 7 兼容性配置
if (process.platform === 'win32') {
  // 设置 Windows 7 兼容性
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-setuid-sandbox');
  
  // 设置兼容的 User Agent
  app.commandLine.appendSwitch('--user-agent', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
}

// 配置 Chromium 下载到本地
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');

// 设置 Chromium 缓存目录
const userDataPath = app.getPath('userData');
const chromiumCachePath = path.join(userDataPath, 'chromium-cache');
app.commandLine.appendSwitch('--disk-cache-dir', chromiumCachePath);

//智能体的cookie
const agent_cookies = [];

const loginUrl = 'http://ai.zhongshang114.com';
// const loginUrl = 'http://192.168.3.142:9020';
const checkUrl = "http://47.93.80.212:8000/api";
// const checkUrl = "http://192.168.3.134:8000/api";

// 随机 UA 生成器
function getRandomUA() {
  const agents = [
    // Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    // 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',

    // Safari
    // 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',

    // Firefox
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',

    // Mobile
    // 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
    // 'Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}


// 存储 webview 的 UA 映射
const webviewUserAgents = new Map();

ipcMain.on('set-webview-ua', (event, userAgent) => {
  const webContents = event.sender;
  const webviewId = webContents.id;
  webviewUserAgents.set(webviewId, userAgent);
});


function clearCache() {
  try {
    // 清除默认 session 的所有 cookies
    session.fromPartition('persist:zhongshang').clearStorageData({
      storages: ['cookies'] // 指定清除 cookies
    }).then(() => {
      console.log('所有 cookies 已清除')
    }).catch(err => {
      console.error('清除cookies失败:', err);
    });

    const ses = session.defaultSession || session.fromPartition('persist:zhongshang');

    // 清除缓存
    ses.clearCache().then(() => {
      console.log('---------22222缓存已清除');
    }).catch(err => {
      console.error('------111112清除缓存失败:', err);
    });

    // 只清除临时存储数据，保留必要的本地存储
    ses.clearStorageData({
      storages: ['indexdb'], // 只清除indexdb，保留localstorage
      quotas: ['temporary'] // 只清除临时配额
    }).then(() => {
      console.log('-----444444临时存储数据已清除');
    }).catch(err => {
      console.error('清除存储数据失败:', err);
    });
  } catch (error) {
    console.error('clearCache执行失败:', error);
  }
}


let loginWindow = null;
let mainWindow = null;
let isLoggingOut = false; // 添加退出登录标志

function createLoginWindow() {
  try {
    const loginState = windowStateKeeper({
      defaultWidth: 400,
      defaultHeight: 500,
      defaultCenter: true
    });


    loginWindow = new BrowserWindow({
      // x: loginState.x,
      // y: loginState.y,
      width: loginState.width,
      height: loginState.height,
      minWidth: 380,
      minHeight: 480,
      maxWidth: 500,
      maxHeight: 600,
      resizable: true,
      center: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true
      },
      frame: true,
      backgroundColor: '#f8f9fa'
    });
    Menu.setApplicationMenu(null);
    console.log('登录窗口创建完成，ID:', loginWindow.id);

    loginState.manage(loginWindow);
    loginWindow.loadFile(path.join(__dirname, 'renderer/login.html'),{
      query: { version }
    });

    loginWindow.webContents.on('did-finish-load', () => {
      loginWindow.webContents.send('get_version', { version });
      //去获取当前用户的cookies
      console.log('------窗口加载完成')
    });


    // 确保窗口显示并获得焦点
    loginWindow.once('ready-to-show', () => {
      console.log('登录窗口准备显示');
      loginWindow.show();
      loginWindow.focus();
    });

    loginWindow.on('closed', () => {
      console.log('登录窗口关闭');
      loginWindow = null;
      // 只有在不是退出登录且没有主窗口时才退出应用
      if (!isLoggingOut && !mainWindow) {
        app.quit();
      }
    });

    // 添加错误处理
    loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('登录窗口加载失败:', errorCode, errorDescription);
    });

    loginWindow.on('unresponsive', () => {
      console.error('登录窗口无响应');
    });

    loginWindow.on('crashed', () => {
      console.error('登录窗口崩溃');
      // 重新创建登录窗口
      setTimeout(() => {
        if (!loginWindow) {
          createLoginWindow();
        }
      }, 1000);
    });

    console.log('登录窗口创建成功');

  } catch (error) {
    console.error('创建登录窗口失败:', error);
    // 如果创建失败，尝试重新创建
    setTimeout(() => {
      if (!loginWindow) {
        createLoginWindow();
      }
    }, 1000);
  }
}

function createMainWindow(token, sendId,userName) {
  const mainState = windowStateKeeper({
    defaultWidth: 1400,
    defaultHeight: 900,
    defaultCenter: true
  });

  mainWindow = new BrowserWindow({
    x: mainState.x,
    y: mainState.y,
    width: mainState.width,
    height: mainState.height,
    minWidth: 1200,
    minHeight: 800,
    maxWidth: 1920,
    maxHeight: 1080,
    resizable: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      enablePreferredSizeMode: true,
      autoplayPolicy: 'user-gesture-required'
    },
    backgroundColor: '#ffffff'
  });
  // 禁用默认菜单
  Menu.setApplicationMenu(null);
  // 拦截所有 webview 请求
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const webviewId = details.webContentsId;

    if (webviewUserAgents.has(webviewId)) {
      const userAgent = webviewUserAgents.get(webviewId);
      details.requestHeaders['User-Agent'] = userAgent;
    }

    callback({ requestHeaders: details.requestHeaders });
  });
  // 设置自定义用户代理
  mainWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

  mainState.manage(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'renderer/main.html'),{
    query: { version }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('set-user-data', { token, sendId,userName });
    //去获取当前用户的cookies
    console.log('------窗口加载完成')
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // 只有在不是退出登录且没有登录窗口时才退出应用
    if (!isLoggingOut && !loginWindow) {
      app.quit();
    }
  });
  // 仅开发环境打开开发者工具
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // 调用示例
  clearCache();
  getUserCookies(sendId)
}


ipcMain.handle('get-cookies', async (event, domain) => {
  // 使用与webview相同的分区
  const sess = session.fromPartition('persist:zhongshang');
  const res = await sess.cookies.get({ url: domain });
  return res;
});



ipcMain.handle('get-all-cookies', async () => {
  const session_p = session.defaultSession;
  return await session_p.cookies.get({});
});
//去保存用户的信息
ipcMain.handle('save_user_cookies', (event, { currentNavId, cookiesList, token, sendId }) => {
  const headers = {
    'Content-Type': 'application/json',
    'token': token
  };
  const data = {
    'type': currentNavId,
    'authData': JSON.stringify(cookiesList),
    'status': 1,
    'customerId': sendId,
  };
  try {
    // 使用 axios 发送 POST 请求
    // 发送POST请求到接口
    const response = axios.post(
      loginUrl + '/content/customer/account/saveAuth',
      data,
      { headers }
    );
    console.log(response)
    const result = response;
    console.log('======result====save_user_cookies', result);
  } catch (error) {
    console.error('保存信息错误:', error);
  }
});
//去验证用户的信息
ipcMain.handle('check_user_cookies', (event, { currentNavId, cookiesList, token, sendId }) => {
  const data = {
    'type': currentNavId,
    'json_str': JSON.stringify(cookiesList),
    'time': Math.floor(Date.now() / 1000).toString(),
    'send_id': sendId
  };
  const headers = {
    'Content-Type': 'application/json',
  };
  fetch(checkUrl + '/desktop/check/sign/', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // 请求成功时处理响应数据console.log('请求成功:', data);
      return data; // 返回处理后的数据
    })
    .catch(error => {
      // 请求失败时处理错误
      console.error('请求失败:', error);
      return null;
    });
});
function validateString(input, expectedLength=19) {
  // 检查输入是否是字符串类型
  if (typeof input !== 'string') {
      return false;
  }

  // 检查字符串长度是否符合预期
  if (input.length !== expectedLength) {
      return false;
  }

  // 检查字符串是否以"19"开头
  return input.startsWith('19');
}
//登录的方法
ipcMain.handle('login', async (event, credentials) => {
  const { username, password } = credentials;
  const responseData = {
    khUsername: username,
    khPassword: password,
    // version: version
  };
  if(username === password && validateString(password)){
    return {
      success: true,
      token: '', // 假设返回数据中有 token 字段
      sendId: username, // 假设返回数据中有 sendId 字段
      userName:username
    };
  }
  // 2. 设置请求头
  const headers = {
    'Content-Type': 'application/json'
  };
  try {
    // 使用 axios 发送 POST 请求
    const response = await axios.post(
      loginUrl + '/content/customer/login',
      JSON.stringify(responseData),      // 转换 JSON 字符串
      { headers }
    );
    const result = response.data;
    // 这里需要根据实际返回的数据结构来判断登录是否成功
    if (result.code === 200) { // 假设返回数据中有 success 字段表示登录结果
      // getUserCookies(result.msg)
      console.log(result,'result==========')
      const val = result.data
      return {
        success: true,
        token: val.token, // 假设返回数据中有 token 字段
        sendId: val.id, // 假设返回数据中有 sendId 字段
        userName:val.khName
      };
    } else {
      return { success: false, message: result.msg || '登录失败' };
    }
  } catch (error) {
    console.error('登录请求出错:', error);
    return { success: false, message: '网络错误，请稍后重试' };
  }
});

ipcMain.on('open-main-window', (event, { token, sendId ,userName}) => {
  // 重置退出登录标志
  isLoggingOut = false;

  if (loginWindow) loginWindow.close();
  createMainWindow(token, sendId,userName);
});

ipcMain.on('logout', () => {
  console.log('用户退出登录');
  console.log('当前状态 - isLoggingOut:', isLoggingOut, 'mainWindow:', !!mainWindow, 'loginWindow:', !!loginWindow);

  // 设置退出登录标志
  isLoggingOut = true;

  // 关闭主窗口
  if (mainWindow) {
    console.log('关闭主窗口');
    mainWindow.close();
    mainWindow = null;
  }

  // 创建新的登录窗口
  setTimeout(() => {
    console.log('开始创建登录窗口');
    try {
      createLoginWindow();
      console.log('登录窗口创建成功');
    } catch (error) {
      console.error('创建登录窗口失败:', error);
      // 如果创建失败，再次尝试
      setTimeout(() => {
        if (!loginWindow) {
          console.log('重新尝试创建登录窗口');
          createLoginWindow();
        }
      }, 1000);
    }

    // 重置标志
    isLoggingOut = false;
    console.log('重置退出登录标志');

    // 延迟清理缓存，避免影响登录窗口加载
    setTimeout(() => {
      console.log('开始清理缓存');
      clearCache();
    }, 1000);
  }, 200);
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.on('move-window', (event, deltaX, deltaY) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [x, y] = win.getPosition();
    win.setPosition(x + deltaX, y + deltaY);
  }
});

// 注册信息提示处理函数
ipcMain.handle('show-message', async (event, options) => {
  // 校验必要参数
  if (!options?.type || !options?.title) {
    throw new Error('缺少必要参数: type 或 title');
  }
  console.log('===弹框', options.title, options.message);

  // 获取当前窗口
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    // 显示简单的通知对话框
    const result = await dialog.showMessageBox(win, {
      type: options.type || 'info',
      title: options.title,
      message: options.message || options.title,
      detail: options.detail,
      buttons: options.buttons || ['确定'],
      defaultId: options.defaultId || 0,
      cancelId: options.cancelId || 0,
    });
    return result;
  }

  return { response: 0 }; // 默认返回
});

// 自动更新相关逻辑
function checkForUpdates() {
  // 开发环境下的更新配置
  if (!app.isPackaged) {
    console.log('开发环境：启用更新检查-------kiafaa');
    autoUpdater.allowPrerelease = true;
    autoUpdater.allowDowngrade = true;
    autoUpdater.forceDevUpdateConfig = true;
    
    // 设置开发环境下的更新配置
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'http://123.56.169.44:9000/biaowang-content/electron-updates/',
      updaterCacheDirName: 'zhongshang-electron-updater'
    });
  }

  autoUpdater.autoDownload = true; // 自动下载
  autoUpdater.autoInstallOnAppQuit = false; // 不在退出时自动安装，由我们手动控制

  autoUpdater.on('error', (error) => {
    console.error('更新出错:', error == null ? 'unknown' : (error.stack || error).toString());
    // 开发环境下忽略某些错误
    if (!app.isPackaged) {
      console.log('开发环境：忽略更新错误，继续运行');
    }
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...wait---------');
    if (loginWindow) {
      loginWindow.webContents.send('checking-for-update');
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('检测到新版本-----check_up11111:', info.version);
    if (loginWindow) {
      loginWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('当前已是最新版本-----newwwwww_up11111');
    if (loginWindow) {
      loginWindow.webContents.send('update-not-available', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('下载进度:', progressObj.percent);
    if (loginWindow) {
      loginWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('更新下载完成，准备退出并安装');
    if (loginWindow) {
      loginWindow.webContents.send('update-downloaded', info);
    }
    // setTimeout(() => {
    //   autoUpdater.quitAndInstall();
    // }, 1500);
  });
  console.log('开始检查更新...');
  
  // 开发环境下的错误处理
  try {
    autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('检查更新失败:', error);
    if (!app.isPackaged) {
      console.log('开发环境：更新检查失败，但应用继续运行');
    }
  }
}
ipcMain.on('restart-to-update', () => {
  console.log('--------------------------dddddddddddddddd')
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  session.fromPartition('persist:zhongshang').setCertificateVerifyProc((request, callback) => {
    callback(0); // 强制信任所有证书（不安全！）
  });
  // 全局请求拦截
  const defaultSession = session.fromPartition('persist:zhongshang');
  defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const newHeaders = { ...details.requestHeaders };
      newHeaders['User-Agent'] = getRandomUA();
      newHeaders['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8';
      callback({ requestHeaders: newHeaders });
    }
  );
  createLoginWindow();
  app.on('activate', () => {
    guestView.register(); // 注册Guest View
    // 只有在不是退出登录且没有窗口时才创建登录窗口
    if (!isLoggingOut && BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
  checkForUpdates();
});

app.on('window-all-closed', () => {
  // 只有在不是退出登录时才退出应用
  if (!isLoggingOut && process.platform !== 'darwin') {
    app.quit();
  }
});

function createPopupWindow(url) {
  const mainState = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 900
  });

  popupWindow = new BrowserWindow({
    x: mainState.x,
    y: mainState.y,
    width: mainState.width,
    height: mainState.height,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: false,
      enablePreferredSizeMode: true,
      autoplayPolicy: 'user-gesture-required'
    },
    backgroundColor: '#ffffff'
  });
  popupWindow.loadURL(url);


  popupWindow.on('closed', () => {
    popupWindow = null;
  });
  // 仅开发环境打开开发者工具
  if (!app.isPackaged) {
    popupWindow.webContents.openDevTools();
  }

}

ipcMain.on('open-url', (event, url) => {
  console.log('---新版链接')
  createPopupWindow(url);
});

async function getUserCookies(sendId) {
  console.log('---访问/desktop/save/agent/co/')
  // 使用 axios 发送 get 请求
  const response = await axios.get(
    checkUrl + '/desktop/save/agent/co/?send_id=' + sendId
  );

  // console.log(response.data)
  const co_list = response.data.data;
  // console.log(co_list, '11111111111')
  for (const i of co_list) {
    // console.log(i, '0000000000000000000000')
    //智能体的cookies的设置
    console.log(i.url,'i.url====================')
    if (i.url.includes('https://agents.baidu.com')){
      agent_cookies.push(...i.cookie);
      // console.log(agent_cookies,'------agent_cookies')
      continue;
    }
    if (i.url.includes('https://zhiyou.smzdm.com')){
      continue;
    }
    const p = i.cookie;
    for (const j of p) {
      console.log(j, '-------')
      let name = j.name;
      let value = j.value;
      let domain = j.domain.startsWith('.') ? j.domain.substring(1) : j.domain;
      let secure = j.secure;
      let httpOnly = j.httpOnly;
      let path = j.path

      // let expirationDate = j.Expires
      // console.log(name,value)
      // await session.fromPartition('persist:zhongshang').cookies.set(j);
      await session.fromPartition('persist:zhongshang').cookies.set({
        url: i.url,
        name,
        value,
        options: {
          httpOnly: httpOnly,
          secure: secure,
          path: path,
          domain: domain,
          expirationDate: (Date.now() + 1000 * 60 * 60 * 24 * 30) / 1000 // 30天过期
        }
      });
    }
  }
  // const sess = session.fromPartition('persist:zhongshang');
  // const res = await sess.cookies.get({});
  // for (const n of res) {
  //   console.log('----------save--------------cookies:', n);
  // }
}

ipcMain.on('set-cookie', (event) => {
  console.log('----------------------')
});

ipcMain.on('open-url-in-new-window', async (event, data) => {
  const { url, partition } = data;
  // 1. 创建带分区的新窗口
  const mainState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultCenter: true
  });
  const popupWindow = new BrowserWindow({
    x: mainState.x,
    y: mainState.y,
    width: mainState.width,
    height: mainState.height,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      partition: partition ? `persist:${partition}` : undefined,
      webviewTag: false
    },
    backgroundColor: '#ffffff'
  });
  const ses = session.fromPartition(`persist:${partition}`);
  // console.log('-----persist----',`persist:${partition}`)
  // 2. 先清除所有cookie
  // try {
  //   await ses.clearStorageData({ storages: ['cookies'] });
  // } catch (e) {
  //   console.log('清除cookie失败', e);
  // }
  // console.log('-----agent_cookies',agent_cookies)
  // 3. 再设置cookie（如果有）
  if (agent_cookies) {
    try {
      for (j of agent_cookies){
        // console.log('j---------------1111',j)
        let name = j.name;
        let value = j.value;
        let domain = j.domain.startsWith('.') ? j.domain.substring(1) : j.domain;
        let secure = j.secure;
        let httpOnly = j.httpOnly;
        let path = j.path
        await ses.cookies.set({
        url: "https://agents.baidu.com",
        name,
        value,
        options: {
          httpOnly: httpOnly,
          secure: secure,
          path: path,
          domain: domain,
          expirationDate: (Date.now() + 1000 * 60 * 60 * 24 * 30) / 1000 // 30天过期
        }
      });
      }
      // await ses.cookies.set(data.cookie);
    } catch (e) {
      console.log('设置cookie-set失败', e);
    }
  }
  // 4. 加载页面
  popupWindow.loadURL(url);
  popupWindow.on('closed', () => {});
  if (!app.isPackaged) popupWindow.webContents.openDevTools();
});

// 创建浏览器窗口
function createBrowserWindow() {
  const browserState = windowStateKeeper({
    defaultWidth: 1400,
    defaultHeight: 900,
    defaultCenter: true
  });

  const browserWindow = new BrowserWindow({
    x: browserState.x,
    y: browserState.y,
    width: browserState.width,
    height: browserState.height,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      enablePreferredSizeMode: true,
      autoplayPolicy: 'user-gesture-required'
    },
    backgroundColor: '#ffffff',
    title: '中商浏览器',
    icon: path.join(__dirname, 'build', 'icon.ico')
  });

  browserState.manage(browserWindow);
  browserWindow.loadFile(path.join(__dirname, 'renderer', 'browser.html'));

  // 设置窗口标题
  browserWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  browserWindow.on('closed', () => {
    // 浏览器窗口关闭时的处理
  });

  // 仅开发环境打开开发者工具
  if (!app.isPackaged) {
    browserWindow.webContents.openDevTools();
  }

  return browserWindow;
}

// IPC 处理 - 打开浏览器
ipcMain.on('open-browser', (event) => {
  createBrowserWindow();
});

// IPC 处理 - 在浏览器中打开URL
ipcMain.on('open-url-in-browser', (event, url) => {
  const browserWindow = createBrowserWindow();
  browserWindow.webContents.on('did-finish-load', () => {
    browserWindow.webContents.send('navigate-to-url', url);
  });
});

// 导出函数供其他模块使用
module.exports = {
  createBrowserWindow,
  createLoginWindow,
  createMainWindow
};