const fs = require('fs');
const path = require('path');
const { downloadChromium } = require('./download-chromium');

class ChromiumManager {
  constructor() {
    this.chromiumDir = path.join(__dirname, '..', 'chromium');
    this.configPath = path.join(this.chromiumDir, 'config.json');
  }

  // 检查 Chromium 是否已安装
  isInstalled() {
    if (!fs.existsSync(this.configPath)) {
      return false;
    }

    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      const chromiumPath = path.join(config.path, this.getExecutableName());
      return fs.existsSync(chromiumPath);
    } catch (error) {
      return false;
    }
  }

  // 获取 Chromium 配置
  getConfig() {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      return null;
    }
  }

  // 获取可执行文件名
  getExecutableName() {
    switch (process.platform) {
      case 'win32':
        return 'chrome.exe';
      case 'darwin':
        return 'Chromium.app/Contents/MacOS/Chromium';
      default:
        return 'chrome';
    }
  }

  // 获取 Chromium 可执行文件路径
  getExecutablePath() {
    const config = this.getConfig();
    if (!config) {
      return null;
    }

    return path.join(config.path, this.getExecutableName());
  }

  // 安装 Chromium
  async install() {
    if (this.isInstalled()) {
      console.log('Chromium 已安装，跳过下载');
      return this.getExecutablePath();
    }

    console.log('开始安装 Chromium...');
    await downloadChromium();
    
    if (this.isInstalled()) {
      console.log('Chromium 安装成功!');
      return this.getExecutablePath();
    } else {
      throw new Error('Chromium 安装失败');
    }
  }

  // 启动 Chromium
  launch(options = {}) {
    const executablePath = this.getExecutablePath();
    if (!executablePath) {
      throw new Error('Chromium 未安装，请先运行 npm run chromium:setup');
    }

    const { execSync } = require('child_process');
    const args = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];

    // 添加用户参数
    if (options.args) {
      args.push(...options.args);
    }

    // 添加启动 URL
    if (options.url) {
      args.push(options.url);
    }

    const command = `"${executablePath}" ${args.join(' ')}`;
    console.log(`启动 Chromium: ${command}`);
    
    try {
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error('启动 Chromium 失败:', error.message);
    }
  }

  // 清理 Chromium
  cleanup() {
    if (fs.existsSync(this.chromiumDir)) {
      const { execSync } = require('child_process');
      
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${this.chromiumDir}"`);
      } else {
        execSync(`rm -rf "${this.chromiumDir}"`);
      }
      
      console.log('Chromium 已清理');
    }
  }

  // 获取状态信息
  getStatus() {
    const config = this.getConfig();
    const installed = this.isInstalled();
    const executablePath = this.getExecutablePath();

    return {
      installed,
      version: config?.version || '未安装',
      platform: config?.platform || process.platform,
      arch: config?.arch || process.arch,
      path: executablePath,
      downloadDate: config?.downloadDate || null
    };
  }
}

// 命令行接口
function main() {
  const manager = new ChromiumManager();
  const command = process.argv[2];

  switch (command) {
    case 'install':
      manager.install().then(() => {
        console.log('安装完成');
      }).catch(error => {
        console.error('安装失败:', error.message);
        process.exit(1);
      });
      break;

    case 'launch':
      const url = process.argv[3];
      manager.launch({ url });
      break;

    case 'status':
      const status = manager.getStatus();
      console.log('Chromium 状态:');
      console.log(JSON.stringify(status, null, 2));
      break;

    case 'cleanup':
      manager.cleanup();
      break;

    default:
      console.log('使用方法:');
      console.log('  node scripts/chromium-manager.js install    - 安装 Chromium');
      console.log('  node scripts/chromium-manager.js launch     - 启动 Chromium');
      console.log('  node scripts/chromium-manager.js launch <url> - 启动 Chromium 并打开指定 URL');
      console.log('  node scripts/chromium-manager.js status     - 查看状态');
      console.log('  node scripts/chromium-manager.js cleanup    - 清理 Chromium');
      break;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = ChromiumManager; 