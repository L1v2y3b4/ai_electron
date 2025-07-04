# Chromium 本地下载和使用指南

本项目提供了多种方式将 Chromium 下载到本地并使用。

## 方法一：使用 npm 命令下载

### 1. 下载 Chromium
```bash
npm run download:chromium
```

### 2. 查看 Chromium 状态
```bash
npm run chromium:status
```

### 3. 启动 Chromium
```bash
npm run chromium:launch
```

### 4. 启动 Chromium 并打开指定 URL
```bash
npm run chromium:launch https://www.google.com
```

### 5. 清理 Chromium
```bash
npm run chromium:cleanup
```

## 方法二：使用 Chromium 管理器

### 安装 Chromium
```bash
node scripts/chromium-manager.js install
```

### 查看状态
```bash
node scripts/chromium-manager.js status
```

### 启动 Chromium
```bash
node scripts/chromium-manager.js launch
```

### 启动并打开 URL
```bash
node scripts/chromium-manager.js launch https://www.google.com
```

### 清理
```bash
node scripts/chromium-manager.js cleanup
```

## 方法三：在 Electron 应用中使用

项目已经配置了 Electron 使用本地 Chromium 缓存：

```javascript
// 在 main.js 中已添加的配置
app.commandLine.appendSwitch('--disk-cache-dir', chromiumCachePath);
```

## 目录结构

下载后的 Chromium 将保存在以下目录：

```
project/
├── chromium/
│   ├── downloads/          # 下载的压缩包
│   ├── chromium-版本号/     # 解压后的 Chromium
│   └── config.json        # 配置文件
```

## 支持的平台

- Windows (x64, ia32)
- macOS (x64)
- Linux (x64, ia32)

## 版本信息

当前配置的 Chromium 版本与 Electron 版本匹配：
- Electron 版本：30.0.0
- Chromium 版本：114.0.5735.198

## 注意事项

1. **网络要求**：下载需要访问 Google 的存储服务，请确保网络连接正常
2. **磁盘空间**：Chromium 下载包约 100-200MB，解压后约 500MB-1GB
3. **权限要求**：解压和安装需要写入权限
4. **防火墙**：某些企业网络可能阻止下载，请检查防火墙设置

## 故障排除

### 下载失败
- 检查网络连接
- 尝试使用 VPN
- 检查防火墙设置

### 解压失败
- 确保有足够的磁盘空间
- 检查文件权限
- 重新下载文件

### 启动失败
- 检查可执行文件是否存在
- 确保有执行权限
- 查看错误日志

## 高级配置

### 自定义下载目录
修改 `scripts/download-chromium.js` 中的 `CHROMIUM_DIR` 变量：

```javascript
const CHROMIUM_DIR = path.join(__dirname, '..', 'custom-chromium-path');
```

### 自定义版本
修改 `scripts/download-chromium.js` 中的 `CHROMIUM_VERSION` 变量：

```javascript
const CHROMIUM_VERSION = 'your-desired-version';
```

### 添加启动参数
在 `scripts/chromium-manager.js` 的 `launch` 方法中添加参数：

```javascript
const args = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--your-custom-flag'  // 添加自定义参数
];
``` 