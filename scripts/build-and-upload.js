const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始构建和上传流程...');

try {
    // 1. 构建应用
    console.log('📦 正在构建应用...');
    execSync('npm run dist:win', { stdio: 'inherit' });
    
    // 2. 上传到Minio
    console.log('☁️ 正在上传到Minio...');
    execSync('npm run upload:minio', { stdio: 'inherit' });
    
    console.log('🎉 构建和上传完成！');
    
} catch (error) {
    console.error('❌ 构建或上传失败:', error.message);
    process.exit(1);
} 