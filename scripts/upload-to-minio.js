const Minio = require('minio');
const fs = require('fs');
const path = require('path');

// Minio配置 - 请根据你的实际配置修改
const minioConfig = {
    endPoint: '123.56.169.44', // 你的minio服务器地址
    port: 9000, // minio端口
    useSSL: false, // 是否使用HTTPS
    accessKey: 'minioadmin', // 你的access key
    secretKey: 'bw#minioadmin', // 你的secret key
    bucketName: 'biaowang-content', // 存储桶名称
    // 添加时间同步配置
    region: 'us-east-1', // 设置区域
    transportOptions: {
        // 增加请求超时时间
        timeout: 30000
    }
};

// 创建Minio客户端
const minioClient = new Minio.Client(minioConfig);

// 检查并同步时间
async function checkTimeSync() {
    try {
        console.log('检查时间同步...');
        // 尝试获取存储桶列表来测试连接和时间同步
        await minioClient.listBuckets();
        console.log('✅ 时间同步正常');
        return true;
    } catch (error) {
        if (error.message.includes('time') || error.message.includes('Time')) {
            console.error('❌ 时间同步问题:', error.message);
            console.log('💡 解决方案:');
            console.log('  1. 检查本地系统时间是否正确');
            console.log('  2. 同步本地时间到网络时间服务器');
            console.log('  3. 检查MinIO服务器时间是否正确');
            return false;
        }
        throw error;
    }
}

// 上传单个文件，带重试机制
async function uploadFile(filePath, objectName, contentType, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`上传文件: ${path.basename(filePath)} -> ${objectName} (尝试 ${i + 1}/${retries})`);
            
            await minioClient.fPutObject(
                minioConfig.bucketName,
                objectName,
                filePath,
                {
                    'Content-Type': contentType
                }
            );
            
            console.log(`✅ 文件上传成功: ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            console.error(`❌ 上传失败 (尝试 ${i + 1}/${retries}): ${error.message}`);
            
            // 如果是时间同步问题，提供更详细的错误信息
            if (error.message.includes('time') || error.message.includes('Time')) {
                console.log('⏰ 时间同步问题检测到，请检查:');
                console.log('  - 本地系统时间是否正确');
                console.log('  - MinIO服务器时间是否正确');
                console.log('  - 网络连接是否稳定');
            }
            
            if (i === retries - 1) {
                throw error;
            }
            // 等待2秒后重试（增加等待时间）
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// 上传文件到Minio
async function uploadToMinio() {
    try {
        console.log('开始上传文件到Minio...');
        
        // 首先检查时间同步
        const timeSyncOk = await checkTimeSync();
        if (!timeSyncOk) {
            console.log('⚠️  检测到时间同步问题，但仍将尝试上传...');
        }
        
        // 检查存储桶是否存在，不存在则创建
        const bucketExists = await minioClient.bucketExists(minioConfig.bucketName);
        if (!bucketExists) {
            console.log(`创建存储桶: ${minioConfig.bucketName}`);
            await minioClient.makeBucket(minioConfig.bucketName);
        }

        // 上传文件
        const distPath = path.join(__dirname, '../dist');
        const files = fs.readdirSync(distPath);
        
        for (const file of files) {
            // 上传 .exe、.blockmap 和 .yml 文件
            if (file.endsWith('.dmg') || file.endsWith('.exe') || file.endsWith('.yml') || file.endsWith('.blockmap')) {
                const filePath = path.join(distPath, file);
                const objectName = `electron-updates/${file}`;
                
                // 根据文件类型设置Content-Type
                let contentType = 'application/octet-stream';
                if (file.endsWith('.yml')) {
                    contentType = 'text/yaml';
                } else if (file.endsWith('.blockmap')) {
                    contentType = 'application/json';
                }
                
                try {
                    await uploadFile(filePath, objectName, contentType);
                } catch (error) {
                    console.error(`❌ 文件上传最终失败: ${file}`);
                    // 继续上传其他文件
                }
            }
        }
        
        console.log('🎉 所有文件上传完成！');
        console.log(`访问地址: http://${minioConfig.endPoint}:${minioConfig.port}/${minioConfig.bucketName}/electron-updates/`);
        console.log('');
        console.log('📋 上传的文件说明:');
        console.log('  - .exe: 完整安装包');
        console.log('  - .blockmap: 增量更新映射文件');
        console.log('  - .yml: 更新描述文件');
        
    } catch (error) {
        console.error('❌ 上传失败:', error);
        process.exit(1);
    }
}

// 执行上传
uploadToMinio(); 