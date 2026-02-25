const fs = require('fs');
const path = require('path');

const [,, oldFile, newFile, configFile] = process.argv;

if (!oldFile || !newFile || !configFile) {
    console.error("错误：脚本启动参数不全。");
    process.exit(1);
}

try {
    const rawCode = fs.readFileSync(path.resolve(oldFile), 'utf-8');
    const mySetting = JSON.parse(fs.readFileSync(path.resolve(configFile), 'utf-8'));
    
    console.log("执行深度扫描，开始注入自定义配置...");

    // 核心定位：寻找 WidgetMetadata 配置块
    const metaRegex = /((?:var|let|const)?\s*WidgetMetadata\s*[:=]\s*\{)([\s\S]*?)(\}(?:\s*;)?)/;
    const match = rawCode.match(metaRegex);

    if (!match) {
        throw new Error("未能定位到配置块，请检查源码结构。");
    }

    let prefix = match[1]; 
    let body = match[2]; 
    let suffix = match[3]; 

    for (const [key, value] of Object.entries(mySetting)) {
        /**
         * 强效匹配正则：
         * 1. \b${key}\b 确保精准匹配字段名（如防止 version 匹配到 requiredVersion）
         * 2. (['"`]?) 捕获可能存在的各种引号
         * 3. [^'"`,\s}]* 匹配直到逗号、大括号或空白符为止的值
         */
        const propRegex = new RegExp(`(\\b${key}\\b\\s*:\\s*)(['"\`]?)[^'\"\`,\\s}]*\\2`);
        
        if (propRegex.test(body)) {
            console.log(`正在覆盖属性: ${key} -> ${value}`);
            body = body.replace(propRegex, `$1"${value}"`);
        } else {
            console.log(`正在新增属性: ${key} -> ${value}`);
            body = `\n    ${key}: "${value}",` + body;
        }
    }

    const finalCode = rawCode.replace(metaRegex, prefix + body + suffix);
    fs.writeFileSync(path.resolve(newFile), finalCode, 'utf-8');
    
    console.log("代码加工完成，成品 danmu.js 已生成。");

} catch (err) {
    console.error("运行时异常：" + err.message);
    process.exit(1);
}
