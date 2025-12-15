const { app, BrowserWindow, ipcMain, session, dialog, Menu } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');
const axios = require('axios');
const { version } = require('./package.json');
const { autoUpdater } = require('electron-updater');

// Windows 7 兼容性配置
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-setuid-sandbox');
  app.commandLine.appendSwitch('--user-agent', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
}

// 配置 Chromium
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');

// 设置 Chromium 缓存目录
const userDataPath = app.getPath('userData');
const chromiumCachePath = path.join(userDataPath, 'chromium-cache');
app.commandLine.appendSwitch('--disk-cache-dir', chromiumCachePath);

// 智能体的cookie
let agent_cookies = [];
let agent_cookies_accounts = {1:[],2:[],3:[],4:[],5:[]}
const loginUrl = 'http://ai.zhongshang114.com';
// const loginUrl = 'http://39.96.205.150:19020'
// const loginUrl = 'http://192.168.0.38:9020'
const checkUrl = "http://47.93.80.212:8000/api";
// const checkUrl = "http://127.0.0.1:8000/api";
// const checkUrl = "http://60.205.188.121:8000/api"
// const checkUrl = "http://192.168.0.35:8000/api"

// 请求去重机制  
const requestTracker = new Map();

function generateRequestId(data) {
  return `${data.userId}_${data.type}_${data.position || 0}_${Date.now()}`;
}

function isRequestPending(requestId) {
  return requestTracker.has(requestId) && requestTracker.get(requestId) === 'pending';
}

function setRequestStatus(requestId, status) {
  requestTracker.set(requestId, status);
  setTimeout(() => {
    requestTracker.delete(requestId);
  }, 5000);
}

// 随机 UA 生成器
function getRandomUA() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
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

function clearCache(partition) {
  try {
    // 清除默认 session 的所有 cookies
    partition = partition || 'persist:zhongshang'
    session.fromPartition(partition).clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb']
    }).then(() => {
      console.log('默认分区所有数据已清除')
    }).catch(err => {
      console.error('清除默认分区数据失败:', err);
    });

    const ses = session.fromPartition(partition);
    
    ses.clearCache().then(() => {
      console.log('清除缓存成功');
    }).catch(err => {
      console.error('清除缓存失败', err);
    });

    ses.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb'],
      quotas: ['temporary', 'persistent']
    }).then(() => {
      console.log('所有存储数据已清除');
    }).catch(err => {
      console.error('清除存储数据失败:', err);
    });
  } catch (error) {
    console.error('clearCache执行失败:', error);
  }
}

let loginWindow = null;
let userListWindow = null;
let mainWindow = null;
let isLoggingOut = false;

function createLoginWindow() {
  try {
    if (loginWindow) {
      loginWindow.destroy();
      loginWindow = null;
    }
    
    const loginState = windowStateKeeper({
      defaultWidth: 360,
      defaultHeight: 400,
      defaultCenter: true
    });

    loginWindow = new BrowserWindow({
      x: loginState.x,
      y: loginState.y,
      width: 360,
      height: 400,
      minWidth: 360,
      minHeight: 450,
      maxWidth: 360,
      maxHeight: 450,
      resizable: true,
      center: true,
      webPreferences: {
        webrtc: false,
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true
      },
      frame: false,
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
      console.log('登录窗口加载完成')
    });

    loginWindow.once('ready-to-show', () => {
      console.log('登录窗口准备显示');
      loginWindow.show();
      loginWindow.focus();
    });

    loginWindow.on('closed', () => {
      console.log('登录窗口关闭');
      loginWindow = null;
      if (!isLoggingOut && !mainWindow && !userListWindow) {
        app.quit();
      }
    });

    loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('登录窗口加载失败:', errorCode, errorDescription);
    });

    loginWindow.on('unresponsive', () => {
      console.error('登录窗口无响应');
    });

    loginWindow.on('crashed', () => {
      console.error('登录窗口崩溃');
      setTimeout(() => {
        if (!loginWindow) {
          createLoginWindow();
        }
      }, 1000);
    });

    console.log('登录窗口创建成功');

  } catch (error) {
    console.error('创建登录窗口失败:', error);
    setTimeout(() => {
      if (!loginWindow) {
        createLoginWindow();
      }
    }, 1000);
  }
}

function createUserListWindow(token, sendId, userName, userType) {
  const userListState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
    defaultCenter: true
  });

  userListWindow = new BrowserWindow({
    x: userListState.x,
    y: userListState.y,
    width: userListState.width,
    height: userListState.height,
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
      webviewTag: false
    },
    backgroundColor: '#ffffff'
  });

  Menu.setApplicationMenu(null);
  userListState.manage(userListWindow);
  userListWindow.loadFile(path.join(__dirname, 'renderer/user-list.html'), {
    query: { version }
  });

  userListWindow.webContents.on('did-finish-load', () => {
    userListWindow.webContents.send('set-user-data', { token, sendId, userName, userType });
    console.log('用户列表窗口加载完成');
  });

  userListWindow.on('closed', () => {
    userListWindow = null;
    if (!mainWindow && !loginWindow && !userListWindow) {
      app.quit();
    }
  });

  if (!app.isPackaged) {
    userListWindow.webContents.openDevTools();
  }

  console.log('用户列表窗口创建成功');
}

function createMainWindow(token, sendId, userName) {
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
  
  Menu.setApplicationMenu(null);
  
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const webviewId = details.webContentsId;
    if (webviewUserAgents.has(webviewId)) {
      const userAgent = webviewUserAgents.get(webviewId);
      details.requestHeaders['User-Agent'] = userAgent;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
  
  mainWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

  mainState.manage(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'renderer/main.html'),{
    query: { version }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('set-user-data', { token, sendId, userName });
    console.log('did-finish-load-窗口加载完成')
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!isLoggingOut && !loginWindow && !userListWindow) {
      app.quit();
    }
  });
  
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  clearCache();
  getUserCookies(sendId);
}

// ============ IPC 处理函数 ============

// 1. 修复 get-cookies
ipcMain.handle('get-cookies', async (event, domain, partition = null) => {
  let sess;
  if (partition) {
    sess = session.fromPartition(partition);
  } else {
    const webContents = event.sender;
    sess = webContents.session;
  }

  try {
    const filter = domain ? { url: domain } : {};
    const res = await sess.cookies.get(filter);
    return res;
  } catch (error) {
    console.error('获取cookies失败:', error);
    return [];
  }
});

ipcMain.handle("clear-cookies", async (event, { partition }) => {
    const temp_partition = partition || 'persist:zhongshang'
    clearCache(temp_partition)
})

// 2. 修复 set-cookies (增强版)
ipcMain.handle("set-cookies", async (event, { targetUrl, cookies, domain, partition }) => {
  // 使用传入的partition，如果没有则使用默认值
  const ses = session.fromPartition(partition || 'persist:zhongshang');
  let successCount = 0;
  let failedCookies = [];
  
  // 定义关键cookie列表，优先确保这些cookie能够被注入
  const keyCookieNames = ['BDUSS', 'BDUSS_BFESS', 'bjhStoken', 'BAIDUID', 'BAIDUID_BFESS'];
  
  console.log(`开始处理cookie注入，总数量: ${cookies.length}, partition: ${partition}`);
  
  // 1. 首先处理关键cookie，确保它们被优先注入
  const keyCookies = cookies.filter(c => keyCookieNames.includes(c.name));
  const normalCookies = cookies.filter(c => !keyCookieNames.includes(c.name));
  
  // 合并为：关键cookie在前，普通cookie在后
  const prioritizedCookies = [...keyCookies, ...normalCookies];
  
  try {
    for (const c of prioritizedCookies) {
      try {
        // 确保cookie对象有效
        if (!c.name || !c.value) {
          failedCookies.push({ name: c.name, reason: '缺少name或value' });
          continue;
        }
        
        // 构建cookie选项 - 首先获取cookie自身的domain
        let cookieDomain = c.domain;
        let cookieUrl = targetUrl;
        
        // 详细日志：记录原始cookie信息
        // console.log(`原始cookie信息: ${c.name}, domain: ${c.domain}, path: ${c.path}, secure: ${c.secure}, httpOnly: ${c.httpOnly}, sameSite: ${c.sameSite}`);
        
        // 特别处理关键cookie，确保使用正确的domain和url
        if (keyCookieNames.includes(c.name)) {
          if (c.name === 'bjhStoken') {
            // bjhStoken是baijiahao.baidu.com的cookie
            cookieDomain = '.baijiahao.baidu.com';
            cookieUrl = 'https://baijiahao.baidu.com';
          } else if (c.name.includes('BDUSS')) {
            // BDUSS是.baidu.com的cookie
            cookieDomain = '.baidu.com';
            cookieUrl = 'https://baidu.com';
          } else if (c.name.includes('BAIDUID')) {
            // BAIDUID是.baidu.com的cookie
            cookieDomain = '.baidu.com';
            cookieUrl = 'https://baidu.com';
          }
        } else {
          // 普通cookie处理
          if (cookieDomain) {
            // 确保domain格式正确，以点开头
            cookieDomain = cookieDomain.startsWith('.') ? cookieDomain : '.' + cookieDomain;
            // 使用http或https，不考虑secure属性，确保兼容性
            cookieUrl = 'https://' + cookieDomain.replace(/^\./, '');
          } else {
            // 如果cookie没有domain，使用默认的baidu.com或baijiahao.baidu.com
            if (c.name.includes('baijiahao') || c.name.includes('bjh')) {
              cookieDomain = '.baijiahao.baidu.com';
              cookieUrl = 'https://baijiahao.baidu.com';
            } else {
              cookieDomain = '.baidu.com';
              cookieUrl = 'https://baidu.com';
            }
          }
        }
        
        // 为每个cookie创建多种注入尝试，确保成功
        const injectionAttempts = [
          // 1. 原始配置
          {
            url: cookieUrl,
            name: String(c.name),
            value: String(c.value),
            domain: cookieDomain,
            path: c.path || "/",
            secure: c.secure !== undefined ? c.secure : false,
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            sameSite: c.sameSite || "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          },
          // 2. 强制使用false作为secure属性
          {
            url: cookieUrl,
            name: String(c.name),
            value: String(c.value),
            domain: cookieDomain,
            path: c.path || "/",
            secure: false,
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            sameSite: c.sameSite || "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          },
          // 3. 强制使用no_restriction作为sameSite属性
          {
            url: cookieUrl,
            name: String(c.name),
            value: String(c.value),
            domain: cookieDomain,
            path: c.path || "/",
            secure: c.secure !== undefined ? c.secure : false,
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            sameSite: "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          },
          // 4. 同时强制使用false作为secure属性和no_restriction作为sameSite属性
          {
            url: cookieUrl,
            name: String(c.name),
            value: String(c.value),
            domain: cookieDomain,
            path: c.path || "/",
            secure: false,
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            sameSite: "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          },
          // 5. 强制使用httpOnly: false
          {
            url: cookieUrl,
            name: String(c.name),
            value: String(c.value),
            domain: cookieDomain,
            path: c.path || "/",
            secure: false,
            httpOnly: false,
            sameSite: "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          }
        ];
        
        // 6. 对于所有cookie，添加额外的尝试，分别使用baidu.com和baijiahao.baidu.com
        // 这确保即使cookie的domain信息不准确，也能被正确注入
        injectionAttempts.push(
          {
            url: 'https://baijiahao.baidu.com',
            name: String(c.name),
            value: String(c.value),
            domain: '.baijiahao.baidu.com',
            path: '/',
            secure: false,
            httpOnly: false,
            sameSite: "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          },
          {
            url: 'https://baidu.com',
            name: String(c.name),
            value: String(c.value),
            domain: '.baidu.com',
            path: '/',
            secure: false,
            httpOnly: false,
            sameSite: "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          },
          {
            url: 'https://baijiahao.baidu.com/builder/rc/home',
            name: String(c.name),
            value: String(c.value),
            domain: '.baijiahao.baidu.com',
            path: '/',
            secure: false,
            httpOnly: false,
            sameSite: "no_restriction",
            expirationDate: !c.session && c.expirationDate ? Number(c.expirationDate) : undefined
          }
        );
        
        // 尝试多种配置，直到成功或所有尝试都失败
        let injectionSuccess = false;
        for (let i = 0; i < injectionAttempts.length; i++) {
          const attempt = injectionAttempts[i];
          
          // 详细日志：记录每个cookie的注入尝试，关键cookie用特殊标记
          const isKeyCookie = keyCookieNames.includes(c.name) ? "[关键] " : "";
        //   console.log(`${isKeyCookie}尝试注入cookie: ${c.name}, 尝试${i+1}, domain: ${attempt.domain}, url: ${attempt.url}, secure: ${attempt.secure}, sameSite: ${attempt.sameSite}`);
          
          try {
            await ses.cookies.set(attempt);
            successCount++;
            // console.log(`${isKeyCookie}成功注入cookie: ${c.name}, 尝试${i+1}成功`);
            injectionSuccess = true;
            break; // 成功后跳出循环
          } catch (attemptErr) {
            console.log(`${isKeyCookie}注入cookie失败: ${c.name}, 尝试${i+1}失败, 原因: ${attemptErr.message}`);
          }
        }
        
        if (!injectionSuccess) {
          // 所有尝试都失败
          const errorDetails = {
            name: c.name,
            domain: c.domain,
            reason: "所有注入尝试失败",
            isKeyCookie: keyCookieNames.includes(c.name)
          };
          failedCookies.push(errorDetails);
          console.error(`[所有尝试失败] 注入cookie失败: ${c.name}`);
        }
      } catch (error) {
        const errorDetails = {
          name: c.name,
          domain: c.domain,
          reason: error.message,
          isKeyCookie: keyCookieNames.includes(c.name)
        };
        failedCookies.push(errorDetails);
        console.error(`处理cookie时出错: ${c.name}`, error);
      }
    }
    
    console.log(`成功注入 ${successCount} 个cookie，失败 ${failedCookies.length} 个`);
    
    // 检查关键cookie注入情况
    const keyCookieResults = keyCookieNames.map(name => {
      const isSuccess = prioritizedCookies.some(c => c.name === name) && 
                       !failedCookies.some(f => f.name === name);
      return { name, isSuccess };
    });
    // console.log('关键cookie注入结果:', keyCookieResults);
    
    if (failedCookies.length > 0) {
      console.log('失败的cookie详情:', failedCookies);
    }
    
    return { ok: true, successCount, failedCount: failedCookies.length, failedCookies, keyCookieResults };
  } catch (err) {
    console.error("Cookie设置失败:", err);
    return { ok: false, error: err.message, successCount, failedCount: failedCookies.length };
  }
});

// 3. 添加兼容的 get-agent-cookies
ipcMain.handle("get-agent-cookies", async (event, data) => {
  try {
    const { position } = data
    console.log('获取智能体cookies');
    const agent_cookies = agent_cookies_accounts[position]
    // 兼容性处理：如果 agent_cookies 存在则返回，否则返回空数组
    if (agent_cookies && agent_cookies.length > 0) {
      const safeCookies = agent_cookies.map(c => ({
        name: String(c.name || ""),
        value: String(c.value || ""),
        domain: String(c.domain || ".baidu.com"),
        path: String(c.path || "/"),
        secure: Boolean(c.secure),
        httpOnly: Boolean(c.httpOnly),
        session: Boolean(c.session),
        expirationDate: c.session ? undefined : (Number(c.expirationDate) || undefined)
      }));
      console.log("返回智能体 cookie:", safeCookies.length);
      return safeCookies;
    }
    
    // 备用方案：尝试从 persist:zhinengti 分区获取
    try {
      const zhinengtiSession = session.fromPartition('persist:zhinengti');
      const cookies = await zhinengtiSession.cookies.get({ url: 'https://agents.baidu.com' });
      console.log("从zhinengti分区获取到cookie:", cookies.length);
      return cookies;
    } catch (fallbackError) {
      console.log('获取智能体cookie失败，返回空数组');
      return [];
    }
  } catch (err) {
    console.error("获取智能体cookie失败:", err);
    return [];
  }
});

// 4. migrate-cookies (保持原样)
ipcMain.handle("migrate-cookies", async (event, { sourcePartition, targetPartition, domain, cookieData }) => {
  try {
    const sourceSession = session.fromPartition(sourcePartition);
    const targetSession = session.fromPartition(targetPartition);
    
    let cookiesToSet = cookieData;
    
    if (typeof cookieData === 'string') {
      try {
        const parsed = JSON.parse(cookieData);
        if (Array.isArray(parsed)) {
          for (let i = 0; i < parsed.length; i++) {
            if (Array.isArray(parsed[i]) && parsed[i].length > 0) {
              cookiesToSet = parsed[i];
              break;
            }
          }
          if (!cookiesToSet || cookiesToSet.length === 0) {
            cookiesToSet = parsed;
          }
        }
      } catch (parseError) {
        console.error("解析Cookie字符串失败:", parseError);
        return { success: false, error: parseError.message };
      }
    }
    
    if (!Array.isArray(cookiesToSet)) {
      console.error("Cookie数据不是数组格式:", typeof cookiesToSet);
      return { success: false, error: "Cookie数据格式错误" };
    }
    
    let successCount = 0;
    for (const cookie of cookiesToSet) {
      if (cookie && typeof cookie === 'object' && cookie.name && cookie.value) {
        try {
          let cookieDomain = cookie.domain || domain.replace(/^https?:\/\//, '');
          if (!cookieDomain.startsWith('.')) {
            cookieDomain = '.' + cookieDomain;
          }
          
          await targetSession.cookies.set({
            url: domain,
            name: cookie.name,
            value: cookie.value,
            domain: cookieDomain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            sameSite: cookie.sameSite || 'unspecified'
          });
          successCount++;
        } catch (cookieError) {
          console.error("设置单个Cookie失败:", cookie.name, cookieError);
        }
      }
    }
    
    return { success: true, migratedCount: successCount, totalCookies: cookiesToSet.length };
  } catch (error) {
    console.error("Cookie迁移失败:", error);
    return { success: false, error: error.message };
  }
});

// 5. save_user_cookies (修复cookies保存逻辑)
ipcMain.handle('save_user_cookies', async (event, { currentNavId, cookiesList, token, sendId, acc_id, position, isMain=0 }) => {
  // 1. 处理数据格式
  let data = {};
  let cookiesToSave = Array.isArray(cookiesList) ? cookiesList : [cookiesList];
  
  const headers = {
    'Content-Type': 'application/json',
    'token': token
  };

  try {
    // 1. 查询已有数据
    // 修复axios请求格式，与解绑请求保持一致
    const checkResponse = await axios.post(
      loginUrl + '/content/customer/account/saveAuth',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'token': token
        }
      }
    );
    
    const existingAccounts = checkResponse.data;
    let existingAccount = null;
    
    // 优先检查相同acc_id的账户，避免重复ID错误
    if (existingAccounts && existingAccounts.length > 0) {
      // 先查找相同acc_id的账户
      if (acc_id) {
        existingAccount = existingAccounts.find(account => account.acc_id === acc_id);
      }
      // 如果没有相同acc_id的账户，再查找相同位置的账户
      if (!existingAccount) {
        existingAccount = existingAccounts.find(account => account.position === position);
      }
    }
    
    // 构建保存的数据，匹配Java后端的请求格式
    // status=1 表示重新授权
    data = {
      'type': currentNavId,
      'authData': JSON.stringify(cookiesToSave),
      'status': 1,
      'saveType': 1,
      'customerId': sendId,
      'isMain': isMain,
      'position': position
    };
    
    // 检查是否存在相同账户，若存在则更新，否则插入
    if (existingAccount) {
      console.log(existingAccount, '存在相同账户，执行更新操作:');
      // 添加id字段进行更新
      data.id = existingAccount.id;
      
      // 检查cookie是否相同，如果相同则跳过保存
      try {
        const existingCookies = JSON.parse(existingAccount.json_str);
        const newCookies = JSON.parse(JSON.stringify(cookiesToSave));
        if (JSON.stringify(existingCookies) === JSON.stringify(newCookies)) {
          console.log('账户cookie数据相同，跳过保存');
          return { success: true, message: '数据相同，跳过保存' };
        }
      } catch (e) {
        console.log("无法比较cookie数据，继续更新");
      }
    } else {
      console.log('不存在相同账户，执行插入操作');
    }
    
    // 2. 执行保存/更新操作
    const saveResponse = await axios.post(
      loginUrl + '/content/customer/account/saveAuth',
      data,
      {
        headers
      }
    );
    
    console.log(saveResponse.data, '======saveResponse====save_user_cookies');
    return saveResponse.data;
  } catch (error) {
    console.error('保存信息错误:', error);
    return { success: false, message: error.message };
  }
});

// 6. check_user_cookies (保持原样)
ipcMain.handle('check_user_cookies', async (event, { currentNavId, cookiesList, token, sendId, acc_id, position, is_main }) => {
  const cookiesToSave = Array.isArray(cookiesList) ? cookiesList : [cookiesList];

  try {
    // const checkResponse = await axios.post(
    //   loginUrl + '/content/customer/account/saveAuth',
    //   {
    //     headers: { 'token': token },
    //     params: {
    //       type: currentNavId,
    //       customerId: sendId,
    //       position: position
    //     }
    //   }
    // );
    
    // const existingAccounts = checkResponse.data;
    // let existingAccount = null;
    
    // if (existingAccounts && existingAccounts.length > 0) {
    //   existingAccount = existingAccounts.find(account => account.position === position);
    // }
    
    // if (existingAccount && existingAccount.acc_id && acc_id && existingAccount.acc_id === acc_id) {
    //   console.log("账号数据已存在，跳过重复创建");
    //   return { success: true, message: "账号已存在" };
    // }

    const data = {
      'type': currentNavId,
      'json_str': JSON.stringify(cookiesToSave),
      'time': Math.floor(Date.now() / 1000).toString(),
      'send_id': sendId,
      'acc_id': acc_id,
      'position': position,
      'is_main': is_main
    };
    
    const headers = { 
      'Content-Type': 'application/json',
      // 'token': token
    };

    const response = await axios.post( checkUrl+ '/desktop/check/sign/', JSON.stringify(data), { headers });
    return response.data;
  } catch (error) {
    console.error('请求失败:', error);
    return { success: false, message: error.message };
  }
});

// 7. 新增 save-account-cookies (新版本兼容)
ipcMain.handle("save-account-cookies", async (event, { userId, type, position, cookies, acc_id }) => {
  try {
    // 生成保存请求的唯一ID
    const saveRequestId = `save_${userId}_${type}_${position || 0}_${Date.now()}`;
    
    // 防止短时间内重复保存
    if (isRequestPending(saveRequestId)) {
      console.log('重复保存请求被阻止:', saveRequestId);
      return { success: true, message: '保存已在进行中' };
    }
    
    setRequestStatus(saveRequestId, 'pending');

    // 处理Cookie数据格式
    let processedCookies = [];
    
    if (typeof cookies === 'string') {
      try {
        const parsedCookies = JSON.parse(cookies);
        if (Array.isArray(parsedCookies)) {
          if (parsedCookies.length > 0 && Array.isArray(parsedCookies[0])) {
            processedCookies = parsedCookies[0];
          } else {
            processedCookies = parsedCookies;
          }
        }
      } catch (parseError) {
        console.error('解析Cookie字符串失败:', parseError);
        processedCookies = [];
      }
    } else if (Array.isArray(cookies)) {
      processedCookies = cookies;
    }

    // 过滤重要Cookie
    const importantCookies = processedCookies.filter(cookie => {
      const importantNames = ['BDUSS', 'BDUSS_BFESS', 'BAIDUID', 'BAIDUID_BFESS', 'token', 'session', 'auth'];
      return importantNames.some(name => cookie.name && cookie.name.includes(name));
    });

    // 发送到服务器保存
    const response = await axios.post(`${checkUrl}/desktop/check/sign/`, {
      user_id: userId,
      type: type,
      position: position,
      cookies: JSON.stringify([importantCookies]),
      acc_id: acc_id
    });

    setRequestStatus(saveRequestId, 'success');
    return { success: true, data: response.data };
  } catch (error) {
    console.error("保存账号Cookie失败:", error);
    const saveRequestId = `save_${userId}_${type}_${position || 0}_${Date.now()}`;
    setRequestStatus(saveRequestId, 'error');
    return { success: false, error: error.message };
  }
});

// 8. 新增 get-account-cookies，用于获取已保存的cookies
ipcMain.handle("get-account-cookies", async (event, { userId, type, position, acc_id }) => {
  try {
    // 从服务器获取已保存的cookies
    const response = await axios.post(`${checkUrl}/desktop/check/sign/`, {
      params: {
        user_id: userId,
        type: type,
        position: position,
        acc_id: acc_id
      }
    });
    
    if (response.data && response.data.success && response.data.data) {
      const cookiesStr = response.data.data;
      try {
        const parsedCookies = JSON.parse(cookiesStr);
        // 确保返回的是一维数组
        if (Array.isArray(parsedCookies) && parsedCookies.length > 0 && Array.isArray(parsedCookies[0])) {
          return parsedCookies[0];
        } else if (Array.isArray(parsedCookies)) {
          return parsedCookies;
        }
      } catch (parseError) {
        console.error('解析Cookie字符串失败:', parseError);
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error("获取账号Cookie失败:", error);
    return [];
  }
});

// 8. 新增 get-account-status
ipcMain.handle('get-account-status', async (event, { userId, type }) => {
  console.log('获取账号信息参数:', userId, type);
  try {
    const response = await axios.get(
      `${checkUrl}/auth/accounts?user_id=${userId}&type_f=${type}`
    );
    
    // console.log(response.data,'账号状态信息++++++++++++++')
    if (response.data.code === 200) {
      // console.log(response.data.data,'账号状态信息==================')
      return {
        success: true,
        accounts: response.data.data
      };
    }
    
    return { success: false, message: '获取账号状态失败' };
  } catch (error) {
    console.error('获取账号状态错误:', error);
    return { success: false, message: '网络错误' };
  }
});

// 9. 新增 clear-account-cookies
ipcMain.handle('clear-account-cookies', async (event, { accountId, menuId }) => {
  try {
    const partitionPatterns = [
      `persist:account_${accountId}`,
      `persist:account_acc_${accountId}`,
      `persist:temp_${menuId}`
    ];
    
    const domainMap = {
      1: "https://baijiahao.baidu.com",
      2: "https://mp.sohu.com",
      3: "https://mp.toutiao.com",
      4: "http://zs.open.chuangmaedu.com",
      5: "https://mp.sina.com.cn",
      6: "https://om.qq.com",
      7: "https://mp.163.com",
      8: "https://post.smzdm.com",
      9: "https://agents.baidu.com"
    };
    
    // 清除所有相关分区的数据
    for (const pattern of partitionPatterns) {
      try {
        const accountSession = session.fromPartition(pattern);
        await accountSession.clearStorageData({
          storages: ['cookies', 'localstorage', 'indexdb']
        });
        console.log(`已清除分区 ${pattern} 的所有数据`);
      } catch (err) {
        console.log(`清除分区 ${pattern} 数据时出错:`, err);
      }
    }
    
    // 同时清除默认分区中对应域名的cookie
    const defaultSession = session.fromPartition('persist:zhongshang');
    if (domainMap[menuId]) {
      try {
        const cookies = await defaultSession.cookies.get({ url: domainMap[menuId] });
        for (const cookie of cookies) {
          await defaultSession.cookies.remove(domainMap[menuId], cookie.name);
        }
        console.log(`已清除默认分区在 ${domainMap[menuId]} 的所有cookie`);
      } catch (err) {
        console.log(`清除默认分区cookie时出错:`, err);
      }
    }
    
    return { success: true, message: `已清除账号相关数据` };
  } catch (error) {
    console.error('清除账号cookie失败:', error);
    return { success: false, message: error.message };
  }
});

// 10. 新增 open-url-in-new-window (智能体兼容)
ipcMain.on('open-url-in-new-window', async (event, data) => {
  const { url, partition, accountId, sendId, position, _type, current_cookie } = data;
  console.log(sendId, position, _type)
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

  // 兼容两种分区命名方式
  let accountPartition;
  if (accountId) {
    accountPartition = `persist:account_${accountId}`;
  } else if (partition) {
    accountPartition = `persist:${partition}`;
  } else {
    accountPartition = 'persist:zhongshang';
  }
  
  const ses = session.fromPartition(accountPartition);

  // 如果URL包含智能体相关，尝试设置智能体cookies
  if (data.url.includes('wenxin') || data.url.includes('agents.baidu.com')) {
    try {
        // 设置cookie前清空缓存
        console.log('智能体清除缓存');
        ses.clearCache().then(() => {
            console.log('清除缓存成功');
        }).catch(err => {
            console.error('清除缓存失败', err);
        });

        ses.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb'],
            quotas: ['temporary', 'persistent']
        }).then(() => {
            console.log('所有存储数据已清除');
        }).catch(err => {
            console.error('清除存储数据失败:', err);
        });
      // 首先尝试使用全局的agent_cookies
      const agent_cookies = agent_cookies_accounts[position]
      if (agent_cookies.length==0){
        try{
            console.log("登录后立即点击智能体事件触发,使用传入的cookies")
            agent_cookies = JSON.parse(JSON.parse(current_cookie))[2]
        } catch (cookieError) {
            console.error('设置智能体cookie失败:', cookieError);
        }
      }
      console.log("当前的智能体cookies", agent_cookies.length)
      
      if (agent_cookies && agent_cookies.length > 0) {
        for (const j of agent_cookies) {
          try {
            await ses.cookies.set({
              url: "https://agents.baidu.com",
              name: j.name,
              value: j.value,
              domain: j.domain || ".baidu.com",
              secure: j.secure || true,
              httpOnly: j.httpOnly || false,
              path: j.path || "/",
              expirationDate: (Date.now() + 1000 * 60 * 60 * 24 * 30) / 1000
            });
          } catch (cookieError) {
            console.error('设置智能体cookie失败:', cookieError);
          }
        }
        console.log('Agent cookies set for partition:', accountPartition);
      }
    } catch (e) {
      console.error('Error setting agent cookies:', e);
    }
  }

  popupWindow.loadURL(url);
  popupWindow.on('closed', () => { });
  if (!app.isPackaged) popupWindow.webContents.openDevTools();
});

// 添加检查用户是否为蓝V套餐的IPC处理函数
ipcMain.handle('check-bluev-package', async (event, userId) => {
  try {
    console.log('检查用户蓝V套餐状态，用户ID:', userId);
    
    const response = await axios.get(
      loginUrl + '/content/open/customer/checkCustomerIsBlueVPackage',
      {
        params: {
          customerId: userId
        }
      }
    );
    
    console.log('蓝V套餐检查结果:', response.data);
    
    if (response.data.code === 200) {
      // 根据接口返回的数据判断是否为蓝V套餐用户
      // 假设返回的数据中包含 isBlueVPackage 或类似字段
      const isBlueV = response.data.data === true || response.data.data === 1 || response.data.data?.isBlueVPackage === true;
      console.log('用户是否为蓝V套餐用户:', isBlueV);
      return {
        success: true,
        isBlueVPackage: isBlueV
      };
    }
    
    return { 
      success: false, 
      isBlueVPackage: false,
      message: response.data.msg || '检查失败' 
    };
  } catch (error) {
    console.error('检查蓝V套餐状态错误:', error);
    return { 
      success: false, 
      isBlueVPackage: false,
      message: '网络错误' 
    };
  }
});

// ============ 其他现有函数 ============

function validateString(input, expectedLength = 19) {
  if (typeof input !== 'string') {
    return false;
  }
  if (input.length !== expectedLength) {
    return false;
  }
  return input.startsWith('19');
}

ipcMain.handle('login', async (event, credentials) => {
  const { username, password } = credentials;
  const responseData = {
    khUsername: username,
    khPassword: password,
  };
  
  if(username === password && validateString(password)){
    return {
      success: true,
      token: '',
      sendId: username,
      userName: username,
      userType: "0"
    };
  }
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
    const response = await axios.post(
      loginUrl + '/content/customer/pythonLogin',
      JSON.stringify(responseData),
      { headers }
    );
    const result = response.data;
    
    if (result.code === 200) {
      const val = result.data
      
      setTimeout(() => {
        getUserCookies(val.id);
      }, 500);
      
      return {
        success: true,
        token: val.token,
        sendId: val.id,
        userName: val.khName,
        userType: val.userType
      };
    } else {
      return { success: false, message: result.msg || '登录失败' };
    }
  } catch (error) {
    console.error('登录请求出错:', error);
    return { success: false, message: '网络错误，请稍后重试' };
  }
});

ipcMain.handle('getMenuIsAuth', async (event, data) => {
  const { id, _type } = data;
  const zmt_mapping = {
    "zmt_bjh": 1,
    "zmt_sohu": 2,
    "zmt_toutiao": 3,
    "zmt_wx": 4,
    "zmt_sina": 5,
    "zmt_tx": 6,
    "zmt_zdm": 7,
    "zmt_wy": 8
  };
  
  const headers = {
    'Content-Type': 'application/json'
  };
  const responseData = {
    id: id,
    dictValue: _type
  };
  
  console.log(responseData, "划分权限接口");
  const response = await axios.get(
    loginUrl + '/content/open/py/date/getMenuIsAuth',
    { 
      headers: headers,
      params: responseData
    }
  );
  
  const result = response.data;
  console.log(result,'权限划分');
  if (result.code === 200){
    const val = result.data;
    const zmt_id = zmt_mapping[_type];
    return { [zmt_id]: val === '1' ? true : false };
  }
  
  return {};
});

ipcMain.handle('unbind-account', async (event, { accountId, userId, currentNavId, type, token, isMain, position }) => {
  try {
    console.log('解绑账号参数:', accountId, userId, currentNavId, type, isMain, position);
    
    // 1. 调用原有的解绑接口
    const response = await axios.post(
      `${checkUrl}/auth/unbind`,
      {},
      {
        params: {
          account_id: accountId,
          user_id: userId
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('解绑账号响应:', response.data);
    
    // 2. 调用Java后端saveAuth接口，将status设置为2（解绑状态）
    if (response.data.code === 200) {
      // 准备解绑数据
      const unbindData = {
        'type': currentNavId,
        'authData': 1,
        'status': 3,
        'saveType': 1,
        'customerId': userId,
        'isMain': isMain,
        'position': position,
      };
      
      // 调用Java后端接口
      const javaResponse = await axios.post(
        loginUrl + '/content/customer/account/saveAuth',
        unbindData,
        {
          headers: {
            'Content-Type': 'application/json',
            'token': token
          }
        }
      );
      
      console.log('Java后端解绑响应:', javaResponse.data);
    }
    
    if (response.data.code === 200) {
      return {
        success: true,
        message: response.data.message,
        accountId: response.data.account_id
      };
    } else {
      return {
        success: false,
        message: response.data.message || '解绑失败'
      };
    }
  } catch (error) {
    console.error('解绑账号错误:', error);
    return {
      success: false,
      message: '网络错误，解绑失败'
    };
  }
});

ipcMain.on('open-main-window', (event, { token, sendId, userName }) => {
  isLoggingOut = false;
  if (loginWindow) loginWindow.close();
  createMainWindow(token, sendId, userName);
});

ipcMain.on('open-user-list-window', (event, { token, sendId, userName, userType }) => {
  isLoggingOut = false;
  if (loginWindow) loginWindow.close();
  createUserListWindow(token, sendId, userName, userType);
});

ipcMain.on('logout', () => {
  console.log('用户退出登录');
  console.log('当前状态 - isLoggingOut:', isLoggingOut, 'mainWindow:', !!mainWindow, 'userListWindow:', !!userListWindow, 'loginWindow:', !!loginWindow);

  isLoggingOut = true;

  if (mainWindow) {
    console.log('关闭主窗口');
    mainWindow.close();
    mainWindow = null;
  }

  if (userListWindow) {
    console.log('关闭用户列表窗口');
    userListWindow.close();
    userListWindow = null;
  }

  setTimeout(() => {
    console.log('开始创建登录窗口');
    try {
      clearCache();
      createLoginWindow();
      console.log('登录窗口创建成功');
    } catch (error) {
      console.error('创建登录窗口失败:', error);
      setTimeout(() => {
        if (!loginWindow) {
          console.log('重新尝试创建登录窗口');
          createLoginWindow();
        }
      }, 1000);
    }

    isLoggingOut = false;
    console.log('重置退出登录标志');
  }, 200);
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.on("set-webview-user-agent", (event, userAgent) => {
  app.userAgentFallback = userAgent;
});

ipcMain.on("enter-webview", (event, data) => {
  console.log("进入WebView:", data);
});

ipcMain.on('move-window', (event, deltaX, deltaY) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [x, y] = win.getPosition();
    win.setPosition(x + deltaX, y + deltaY);
  }
});

ipcMain.handle('show-message', async (event, options) => {
  if (!options?.type || !options?.title) {
    throw new Error('缺少必要参数: type 或 title');
  }
  console.log(options.title, options.message, '===弹框');

  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
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

  return { response: 0 };
});

// 自动更新相关逻辑
function checkForUpdates() {
  if (!app.isPackaged) {
    console.log('开发环境：启用更新检查-------kiafaa');
    autoUpdater.allowPrerelease = true;
    autoUpdater.allowDowngrade = true;
    autoUpdater.forceDevUpdateConfig = true;
    
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'http://123.56.169.44:9000/biaowang-content/electron-updates/',
      updaterCacheDirName: 'zhongshang-electron-updater'
    });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('error', (error) => {
    console.error('更新出错:', error == null ? 'unknown' : (error.stack || error).toString());
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
  });
  
  console.log('开始检查更新...');
  
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

// ============ 辅助函数 ============

function createPopupWindow(url) {
  const mainState = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 900
  });

  const popupWindow = new BrowserWindow({
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
  
  if (!app.isPackaged) {
    popupWindow.webContents.openDevTools();
  }
}

ipcMain.on('open-url', (event, url) => {
  console.log('---新版链接')
  createPopupWindow(url);
});

const userCookieCache = new Map();

async function getUserCookies(sendId) {
    console.log("反向登录")
  console.log('---GET /desktop/save/agent/co/ for user:', sendId);
  try {
    const response = await axios.get(`${checkUrl}/desktop/save/agent/co/?send_id=${sendId}`);
    const coList = response.data.data || [];

    if (!userCookieCache.has(sendId)) {
      userCookieCache.set(sendId, new Map());
    }
    const userCache = userCookieCache.get(sendId);

    for (const item of coList) {
      console.log(item.url, 'i.url====================');
      if (item.url.includes('https://agents.baidu.com')) {
        // 特殊处理 agent cookies - 同时保存到全局变量和用户缓存
        // agent_cookies = [...(agent_cookies || []), ...item.cookie];
        // 按位置写入智能体缓存cookie
        agent_cookies_accounts[item.position].push(...item.cookie)
        // agent_cookies.push(...item.cookie);
        console.log('智能体cookies已更新，数量:', agent_cookies_accounts[item.position].length);
        
        // 也保存到用户缓存
        if (!userCache.has(9)) {
          userCache.set(9, []);
        }
        userCache.get(9).push(...item.cookie);
        continue;
      }
      if (item.url.includes('https://zhiyou.smzdm.com')) {
        continue;
      }

      const menuId = getMenuIdFromUrl(item.url);
      if (menuId === undefined) continue;

      if (!userCache.has(menuId)) {
        userCache.set(menuId, []);
      }
      userCache.get(menuId).push(...item.cookie);
    }
    console.log(`User ${sendId} cookies cached.`);
  } catch (error) {
    console.error('Error fetching user cookies:', error);
  }
}

function getMenuIdFromUrl(url) {
  if (url.includes('baijiahao.baidu.com')) return 1;
  if (url.includes('mp.sohu.com')) return 2;
  if (url.includes('mp.toutiao.com')) return 3;
  if (url.includes('zs.open.chuangmaedu.com')) return 4;
  if (url.includes('mp.sina.com.cn')) return 5;
  if (url.includes('om.qq.com')) return 6;
  if (url.includes('mp.163.com')) return 7;
  if (url.includes('post.smzdm.com')) return 8;
  if (url.includes('agents.baidu.com')) return 9;
  return undefined;
}

ipcMain.on('set-cookie', (event) => {
  console.log('----------------------')
});

// 获取服务商的子账户列表
ipcMain.handle('get_user_list', async (event, token, khName = '', khUsername = '', userType = 1, pageSize = 10, pageNum = 1, khPhone = '') => {
  const headers = {
    'token': token
  };
  
  try {
    const response = await axios.get(
      loginUrl + `/content/customer/getCustomerList?userType=${userType}&pageSize=${pageSize}&khName=${khName}&khUsername=${khUsername}&pageNum=${pageNum}&khPhone=${khPhone}`,
      { headers }
    );
    
    const result = response.data;
    console.log(result,'get_user_list-result');
    
    if (result.code === 200) {
      return result;
    } else {
      return { success: false, message: result.msg || '登录失败' };
    }
  } catch (error) {
    console.error('登录请求出错:', error);
    return { success: false, message: '网络错误，请稍后重试' };
  }
});

// ============ 应用启动 ============

app.whenReady().then(() => {
  session.fromPartition('persist:zhongshang').setCertificateVerifyProc((request, callback) => {
    callback(0); // 强制信任所有证书（不安全！）
  });
  
  createLoginWindow();
  
  app.on('activate', () => {
    if (!isLoggingOut && BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
  
  checkForUpdates();
});

app.on('window-all-closed', () => {
  if (!isLoggingOut && process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = {
  // createBrowserWindow,
  createLoginWindow,
  createMainWindow
};