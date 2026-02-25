const fs = require('fs');
const path = require('path');

// 接收三个参数：原版路径、成品路径、设置路径
const [,, oldFile, newFile, configFile] = process.argv;

if (!oldFile || !newFile || !configFile) {
    console.error("错误：脚本启动参数不足。");
    process.exit(1);
}

try {
    // 强制使用 UTF-8 读取，确保中文无乱码
    const rawCode = fs.readFileSync(path.resolve(oldFile), 'utf-8');
    const mySetting = JSON.parse(fs.readFileSync(path.resolve(configFile), 'utf-8'));
    
    console.log("正在执行全文本扫描，定位配置块位置...");

    // 核心正则：匹配 WidgetMetadata 赋值或定义块
    // 支持 var/let/const，支持冒号或等号，支持有无分号结尾
    const metaRegex = /((?:var|let|const)?\s*WidgetMetadata\s*[:=]\s*\{)([\s\S]*?)(\}(?:\s*;)?)/;
    const match = rawCode.match(metaRegex);

    if (!match) {
        console.error("自查失败：无法在源码中发现 WidgetMetadata 定义。以下是代码前 200 个字符用于排查：");
        console.error(rawCode.substring(0, 200));
        throw new Error("上游代码结构可能发生了重大变更，未找到匹配标识。");
    }

    let head = match[1]; // 块开头部分
    let body = match[2]; // 配置项内容
    let tail = match[3]; // 块结束部分

    // 按照 设置.json 执行属性覆盖
    for (const [key, value] of Object.entries(mySetting)) {
        const itemRegex = new RegExp(`(${key}\\s*:\\s*)(['"\`])[^'"\`]*\\2`);
        
        if (itemRegex.test(body)) {
            // 字段已存在，直接替换
            body = body.replace(itemRegex, `$1"${value}"`);
        } else {
            // 字段不存在，在块内首行强制插入
            body = `\n    ${key}: "${value}",` + body;
        }
    }

    // 将加工后的配置块缝合回原位置
    const finalResult = rawCode.replace(metaRegex, head + body + tail);
    
    // 写入成品文件
    fs.writeFileSync(path.resolve(newFile), finalResult, 'utf-8');
    console.log("加工完成：配置已成功注入成品文件。");

} catch (err) {
    console.error("处理过程中出现异常：" + err.message);
    process.exit(1);
}
