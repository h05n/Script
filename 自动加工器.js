const fs = require('fs');
const path = require('path');

/**
 * 核心处理逻辑：
 * 1. 采用 UTF-8 编码强制读取与写入。
 * 2. 使用非贪婪正则定位 WidgetMetadata 块，支持 var/let/const 以及多种赋值符号。
 * 3. 严格遵循 设置.json 的配置，对属性进行覆盖或插入。
 */

const [,, oldFile, newFile, configFile] = process.argv;

if (!oldFile || !newFile || !configFile) {
    console.error("构建失败：参数传递不完整。");
    process.exit(1);
}

try {
    const rawCode = fs.readFileSync(path.resolve(oldFile), 'utf-8');
    const mySetting = JSON.parse(fs.readFileSync(path.resolve(configFile), 'utf-8'));
    
    console.log("正在定位代码中的配置块区域...");

    // 匹配标识符 WidgetMetadata 及其大括号内的内容
    const metaRegex = /((?:var|let|const)?\s*WidgetMetadata\s*[:=]\s*\{)([\s\S]*?)(\}(?:\s*;)?)/;
    const match = rawCode.match(metaRegex);

    if (!match) {
        throw new Error("源码特征校验失败：未能在文件中发现 WidgetMetadata 定义块。");
    }

    let head = match[1]; 
    let body = match[2]; 
    let tail = match[3]; 

    // 遍历用户设置执行注入
    for (const [key, value] of Object.entries(mySetting)) {
        const itemRegex = new RegExp(`(${key}\\s*:\\s*)(['"\`])[^'"\`]*\\2`);
        
        if (itemRegex.test(body)) {
            // 字段存在则更新值
            body = body.replace(itemRegex, `$1"${value}"`);
        } else {
            // 字段缺失则在块起始位置新增
            body = `\n    ${key}: "${value}",` + body;
        }
    }

    // 重新合成并输出至 danmu.js
    const finalResult = rawCode.replace(metaRegex, head + body + tail);
    fs.writeFileSync(path.resolve(newFile), finalResult, 'utf-8');
    
    console.log("注入任务已成功完成。");

} catch (err) {
    console.error("加工过程出现异常：" + err.message);
    process.exit(1);
}
