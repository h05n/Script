const fs = require('fs');
const path = require('path');

// 拿命令行传进来的几个路径
const [,, oldFile, newFile, configFile] = process.argv;

if (!oldFile || !newFile || !configFile) {
    console.error("参数没传够，干不了活。");
    process.exit(1);
}

try {
    // 读取上游源码和你自己的设置
    const rawCode = fs.readFileSync(path.resolve(oldFile), 'utf-8');
    const mySetting = JSON.parse(fs.readFileSync(path.resolve(configFile), 'utf-8'));
    
    console.log("正在扫描全文本，寻找配置块...");

    // 匹配 WidgetMetadata 这一块，管它在不在开头都能抓到
    const metaRegex = /((?:var|let|const)?\s*WidgetMetadata\s*[:=]\s*\{)([\s\S]*?)(\}(?:\s*;)?)/;
    const match = rawCode.match(metaRegex);

    if (!match) {
        throw new Error("没找着 WidgetMetadata，原作者代码可能改名了。");
    }

    let head = match[1]; 
    let body = match[2]; 
    let tail = match[3]; 

    // 遍历你的设置，挨个往代码里塞
    for (const [key, value] of Object.entries(mySetting)) {
        // \b 是为了精准匹配，防止改 version 时误伤 requiredVersion
        const itemRegex = new RegExp(`(\\b${key}\\b\\s*:\\s*)(['"\`]?)[^'\"\`,\\s}]*\\2`);
        
        if (itemRegex.test(body)) {
            // 原代码有这一项，直接换掉
            console.log(`替换属性: ${key} -> ${value}`);
            body = body.replace(itemRegex, `$1"${value}"`);
        } else {
            // 原代码没有，就补在最前面
            console.log(`新增属性: ${key} -> ${value}`);
            body = `\n    ${key}: "${value}",` + body;
        }
    }

    // 把改好的部分塞回去
    const finalContent = rawCode.replace(metaRegex, head + body + tail);
    
    // 存成 danmu.js，这是你要的成品
    fs.writeFileSync(path.resolve(newFile), finalContent, 'utf-8');
    console.log("加工好了，danmu.js 已生成。");

} catch (err) {
    console.error("执行出错了：" + err.message);
    process.exit(1);
}
