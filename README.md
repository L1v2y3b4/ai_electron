# 中商Electron项目

## 项目简介
面向企业客户的跨平台桌面应用，提供：
- 用户身份认证与权限管理
- 数据可视化看板
- 自动化报告生成
- 系统健康状态监控

## 技术栈全景
```
┌───────────────┐
│   Electron 23  │
├───────────────┤
│  Chromium 108  │
├───────────────┤
│  Node.js 16    │
├───────────────┤
│  React 18      │
├───────────────┤
│  Webpack 5     │
└───────────────┘
```

### 核心依赖
| 模块          | 版本   | 用途                 |
|--------------|--------|----------------------|
| electron-builder | 23.6.0 | 安装包构建           |
| sqlite3      | 5.1.6  | 本地数据存储         |
| axios        | 1.3.4  | HTTP通信             |
| chart.js     | 4.2.1  | 数据可视化           |

## 架构特性
1. **多进程架构**：主进程负责系统级操作，渲染进程处理UI
2. **自动更新**：基于electron-updater实现静默更新
3. **安全沙箱**：渲染进程运行在Chromium沙箱环境
4. **性能监控**：集成Prometheus客户端指标

## 自动更新功能

本项目已集成完整的自动更新功能，支持自动检测、下载和安装新版本。

### 配置说明

#### 1. Minio服务器配置

请修改 `scripts/upload-to-minio.js` 中的配置：

```javascript
const minioConfig = {
    endPoint: '123.56.169.44', // 你的minio服务器地址
    port: 9000, // minio端口
    useSSL: false, // 是否使用HTTPS
    accessKey: 'minioadmin', // 你的access key
    secretKey: 'bw#minioadmin', // 你的secret key
    bucketName: 'biaowang-content' // 存储桶名称
};
```

#### 2. 更新服务器URL配置

请修改 `package.json` 中的 `build.publish.url`：

```json
"publish": [
    {
        "provider": "generic",
        "url": "http://123.56.169.44:9000/electron-updates/"
    }
]
```

### 使用方法

#### 1. 安装依赖

```bash
npm install
```

#### 2. 开发环境测试

```bash
# 启动开发环境
npm start

# 测试更新功能（独立脚本）
npm run test:update
```

#### 3. 一键构建并上传

```bash
npm run build:upload
```

这个命令会：
- 构建Windows安装包
- 自动上传到Minio服务器
- 生成更新描述文件

#### 4. 分步操作

如果只想构建：
```bash
npm run dist:win
```

如果只想上传：
```bash
npm run upload:minio
```

### 开发环境配置

项目已创建 `dev-app-update.yml` 文件，用于开发环境下的自动更新配置：

```yaml
provider: generic
url: http://123.56.169.44:9000/electron-updates/
updaterCacheDirName: zhongshang-electron-updater
```

### 文件结构

构建完成后，以下文件会被上传到Minio：
- `zhongshang Setup 1.3.1.exe` - 安装包
- `latest.yml` - 更新描述文件

### 自动更新流程

1. 应用启动时自动检测新版本
2. 发现新版本时显示下载进度
3. 下载完成后提示用户重启安装
4. 用户确认后自动重启并安装新版本

### 注意事项

- 确保Minio服务器可以公网访问
- 每次发布新版本时，需要更新 `package.json` 中的 `version` 字段
- 上传的文件会自动覆盖旧版本
- 建议在发布前测试自动更新功能
- **开发环境测试**：项目已配置支持开发环境下的更新检查，可以直接在开发模式下测试自动更新功能
- **错误处理**：开发环境下的更新错误不会影响应用正常运行