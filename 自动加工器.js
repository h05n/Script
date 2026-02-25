const fs = require('fs');
const path = require('path');

// 接收运行参数：[原版代码路径, 成品输出路径, 设置文件路径]
const [,, oldFile, newFile, configFile] = process.argv;

if (!oldFile || !newFile || !configFile) {
    console.error("错误：脚本启动参数缺失。");
    process.exit(1);
}

try {
    // 强制使用 UTF-8 编码，确保中文配置项不乱码
    const rawCode = fs.readFileSync(path.resolve(oldFile), 'utf-8');
    const mySetting = JSON.parse(fs.readFileSync(path.resolve(configFile), 'utf-8'));
    
    console.log("正在按照您的‘设置.json’深度定制代码...");

    /**
     * 正则说明：锁定 var WidgetMetadata = { ... }; 这一段配置区。
     * 使用非贪婪匹配，只改动文件头部的定义，不波及后续业务代码。
     */
    const metaRegex = /(var\s+WidgetMetadata\s*=\s*\{)([\s\S]*?)(\};)/;
    const match = rawCode.match(metaRegex);

    if (!match) {
        throw new Error("没能定位到代码头部的配置块，原作者代码结构可能已改变。");
    }

    let head = match[1];
    let body = match[2];
    let tail = match[3];

    // 智能填充设置项
    for (const [key, value] of Object.entries(mySetting)) {
        // 匹配字段名及引号内的值
        const itemRegex = new RegExp(`(${key}\\s*:\\s*)(['"\`])[^'"\`]*\\2`);
        
        if (itemRegex.test(body)) {
            // 字段存在：执行精准替换
            body = body.replace(itemRegex, `$1"${value}"`);
        } else {
            // 字段缺失：在配置块首行插入新属性
            body = `\n    ${key}: "${value}",` + body;
        }
    }

    // 合并生成最终文件
    const finalContent = rawCode.replace(metaRegex, head + body + tail);
    fs.writeFileSync(path.resolve(newFile), finalContent, 'utf-8');
    
    console.log("加工圆满完成！");

} catch (err) {
    console.error("执行过程中发生异常：" + err.message);
    process.exit(1);
}
