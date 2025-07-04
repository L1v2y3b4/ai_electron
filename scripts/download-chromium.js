const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Chromium 快照基础地址
const CHROMIUM_BASE_URL = 'https://storage.googleapis.com/chromium-browser-snapshots';

// 平台和架构判断
const PLATFORM = process.platform === 'win32' ? 'Win' : 
                 process.platform === 'darwin' ? 'Mac' : 'Linux';
const ARCH = process.argv.includes('--x64') ? 'x64' : 'ia32';

// 目录
const CHROMIUM_DIR = path.join(__dirname, '..', 'chromium');
const DOWNLOAD_DIR = path.join(CHROMIUM_DIR, 'downloads');

// 获取最新构建号
async function getLatestBuildNumber() {
  return new Promise((resolve, reject) => {
    let archSuffix = '';
    if (process.platform === 'win32') {
      archSuffix = ARCH === 'x64' ? '_x64' : '';
    } else if (process.platform === 'linux') {
      archSuffix = '_x64';
    }
    const url = `${CHROMIUM_BASE_URL}/${PLATFORM}${archSuffix}/LAST_CHANGE`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', reject);
  });
}

// 下载文件
async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function downloadChromium() {
  try {
    // 创建目录
    if (!fs.existsSync(CHROMIUM_DIR)) {
      fs.mkdirSync(CHROMIUM_DIR, { recursive: true });
    }
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    console.log('正在获取最新 Chromium 构建号...');
    let archSuffix = '';
    if (process.platform === 'win32') {
      archSuffix = ARCH === 'x64' ? '_x64' : '';
    } else if (process.platform === 'linux') {
      archSuffix = '_x64';
    }
    const buildNumber = await getLatestBuildNumber();
    console.log(`最新构建号: ${buildNumber}`);

    // 下载地址
    const downloadUrl = `${CHROMIUM_BASE_URL}/${PLATFORM}${archSuffix}/${buildNumber}/chrome-${PLATFORM.toLowerCase()}.zip`;
    const zipPath = path.join(DOWNLOAD_DIR, `chromium-${buildNumber}-${PLATFORM}${archSuffix}.zip`);

    console.log(`下载地址: ${downloadUrl}`);
    console.log(`保存路径: ${zipPath}`);

    // 下载 Chromium
    await downloadFile(downloadUrl, zipPath);
    console.log('Chromium 下载完成!');

    // 解压
    console.log('正在解压...');
    const extractPath = path.join(CHROMIUM_DIR, `chromium-${buildNumber}`);
    if (process.platform === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`);
    } else {
      execSync(`unzip -o "${zipPath}" -d "${extractPath}"`);
    }
    console.log(`Chromium 已解压到: ${extractPath}`);

    // 清理下载包
    fs.unlinkSync(zipPath);
    console.log('下载文件已清理');

    // 保存配置信息
    const config = {
      buildNumber,
      platform: PLATFORM,
      arch: ARCH,
      path: extractPath,
      downloadDate: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(CHROMIUM_DIR, 'config.json'),
      JSON.stringify(config, null, 2)
    );
    console.log('Chromium 配置已保存');
    console.log('下载完成!');
  } catch (error) {
    console.error('下载失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  downloadChromium();
}

module.exports = { downloadChromium }; 