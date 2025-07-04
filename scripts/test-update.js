const { autoUpdater } = require('electron-updater');
const path = require('path');

console.log('🧪 开始测试自动更新功能...');

// 配置更新服务器
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'http://123.56.169.44:9000/biaowang-content/electron-updates/',
  updaterCacheDirName: 'zhongshang-electron-updater'
});

// 开发环境配置
autoUpdater.allowPrerelease = true;
autoUpdater.allowDowngrade = true;
autoUpdater.forceDevUpdateConfig = true;

// 事件监听
autoUpdater.on('checking-for-update', () => {
  console.log('✅ 正在检查更新...');
});

autoUpdater.on('update-available', (info) => {
  console.log('🎉 检测到新版本:', info.version);
  console.log('📦 版本信息:', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('📋 当前已是最新版本');
  console.log('📦 版本信息:', info);
});

autoUpdater.on('error', (error) => {
  console.error('❌ 更新出错:', error);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('📥 下载进度:', progressObj.percent + '%');
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ 更新下载完成:', info);
});

// 开始检查更新
console.log('🚀 开始检查更新...');
autoUpdater.checkForUpdates(); 