# 构建指南

## 网络问题解决方案

如果您在运行 `npm run dist` 时遇到网络连接问题，可以使用以下解决方案：

### 方案1：使用国内镜像源（推荐）

运行以下命令：
```bash
npm run dist:cn
```

这个命令会自动使用淘宝镜像源来下载 Electron 二进制文件。

### 方案2：手动设置环境变量

在 PowerShell 中运行：
```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run dist
```

### 方案3：使用 .npmrc 配置文件

项目根目录已经包含了 `.npmrc` 文件，配置了国内镜像源。如果问题仍然存在，可以尝试：

1. 清除缓存：
```bash
npm cache clean --force
```

2. 删除 node_modules 并重新安装：
```bash
rm -rf node_modules
npm install
```

3. 然后重新构建：
```bash
npm run dist
```

## 构建输出

构建成功后，会在 `dist` 目录下生成以下文件：
- `zhongshang Setup 1.3.8.exe` - Windows 安装程序
- `win-unpacked/` - 解压后的应用程序（x64）
- `win-ia32-unpacked/` - 解压后的应用程序（ia32）
- `latest.yml` - 自动更新配置文件

## 其他构建命令

- `npm run pack` - 打包应用程序（不创建安装程序）
- `npm run dist:win` - 构建并发布到远程服务器
- `npm run dist:win7` - 构建 32 位版本（兼容 Windows 7）
- `npm run dist:mac` - 构建 macOS 版本

## Chromium 相关命令

项目还包含了 Chromium 管理功能：

- `npm run chromium:setup` - 下载 Chromium
- `npm run chromium:install` - 安装 Chromium
- `npm run chromium:launch` - 启动 Chromium
- `npm run chromium:status` - 查看 Chromium 状态
- `npm run chromium:cleanup` - 清理 Chromium

## 故障排除

如果仍然遇到问题：

1. 检查网络连接
2. 确保防火墙没有阻止下载
3. 尝试使用 VPN 或代理
4. 检查磁盘空间是否充足（需要至少 500MB 可用空间） 