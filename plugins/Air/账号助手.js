/**
 * @author Air
 * @team Air
 * @name 账号助手
 * @version 1.0.0
 * @description 账号密码管理插件，支持历史记录、按平台+分类、多用户隔离、JSON持久化
 * @rule ^账号保存\s+(\S+)\s+(\S+)\s+(\S+)\s*(\S*)$
 * @rule ^账号查询$
 * @rule ^账号查询\s+(\S+)$
 * @rule ^账号删除\s+(\S+)\s+(\S+)$
 * @rule ^账号导出$
 * @rule ^账号导入\s+(.+)$
 * @rule ^账号帮助$
 * @priority 10
 * @admin false
 * @public true
 * @encrypt false
 * @disable false
 * @classification ["Air"]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置
const DATA_DIR = path.join(__dirname, 'accounts');
const SECRET_KEY = 'bncr_ultimate_singlefile_2025';
const userStore = {};

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 加密函数
function encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', SECRET_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// 解密函数
function decrypt(text) {
    const decipher = crypto.createDecipher('aes-256-cbc', SECRET_KEY);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 保存用户数据到文件
function saveUserData(userId) {
    const filePath = path.join(DATA_DIR, `${userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(userStore[userId], null, 2), 'utf8');
    console.log(`数据已保存: ${filePath}`);
}

// 从文件加载用户数据
function loadUserData(userId) {
    const filePath = path.join(DATA_DIR, `${userId}.json`);
    if (fs.existsSync(filePath)) {
        userStore[userId] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`数据已加载: ${filePath}`);
    } else {
        userStore[userId] = {};
    }
}

// 初始化用户数据
function initUser(userId) {
    if (!userStore[userId]) {
        loadUserData(userId);
    }
}

module.exports = async (s) => {
    const msg = s.getMsg().trim();
    const userId = s.getUserId();
    const groupId = s.getGroupId();
    const isPrivateChat = !groupId || groupId === '0' || groupId === 0;
    
    // 初始化用户数据
    initUser(userId);
    
    // 账号保存
    const saveMatch = msg.match(/^账号保存\s+(\S+)\s+(\S+)\s+(\S+)\s*(\S*)$/);
    if (saveMatch) {
        const platform = saveMatch[1];
        const account = saveMatch[2];
        const password = saveMatch[3];
        const tag = saveMatch[4] || '默认';
        
        // 初始化平台数据
        if (!userStore[userId][platform]) {
            userStore[userId][platform] = {};
        }
        
        const now = Date.now();
        const encryptedPassword = encrypt(password);
        
        if (!userStore[userId][platform][account]) {
            // 新账号
            userStore[userId][platform][account] = {
                password: encryptedPassword,
                tag,
                savedAt: now,
                history: []
            };
            saveUserData(userId);
            return s.reply(`✅ 新账号保存成功\n平台: ${platform}\n账号: ${account}\n分类: ${tag}`);
        } else {
            // 更新账号
            const currentPassword = decrypt(userStore[userId][platform][account].password);
            if (currentPassword === password) {
                // 密码相同，只更新分类
                userStore[userId][platform][account].tag = tag;
                saveUserData(userId);
                return s.reply(`✅ 账号信息已更新\n平台: ${platform}\n账号: ${account}\n分类: ${tag}\n（密码无变化）`);
            } else {
                // 密码不同，记录历史
                userStore[userId][platform][account].history.push({
                    password: userStore[userId][platform][account].password,
                    updatedAt: now
                });
                userStore[userId][platform][account].password = encryptedPassword;
                userStore[userId][platform][account].tag = tag;
                saveUserData(userId);
                return s.reply(`⚡️ 账号密码已更新\n平台: ${platform}\n账号: ${account}\n分类: ${tag}\n历史记录已保存`);
            }
        }
    }
    
    // 查询所有账号
    if (msg === '账号查询') {
        if (Object.keys(userStore[userId]).length === 0) {
            return s.reply(`❌ 你还没有保存任何账号\n发送"账号帮助"查看使用说明`);
        }
        
        let result = `🔒 所有平台账号信息\n\n`;
        let totalAccounts = 0;
        
        for (const platform in userStore[userId]) {
            const accounts = userStore[userId][platform];
            const accountCount = Object.keys(accounts).length;
            totalAccounts += accountCount;
            
            result += `📱 平台: ${platform} (${accountCount}个账号)\n`;
            
            for (const acc in accounts) {
                const data = accounts[acc];
                
                if (isPrivateChat) {
                    result += `  • ${acc}\n    密码: ${decrypt(data.password)}\n    分类: ${data.tag}\n    保存: ${new Date(data.savedAt).toLocaleString()}\n`;
                    if (data.history.length > 0) {
                        result += `    历史: ${data.history.length}条记录\n`;
                    }
                } else {
                    result += `  • ${acc} [${data.tag}] (密码仅私聊显示)\n`;
                }
            }
            result += '\n';
        }
        
        result += `📊 总计: ${Object.keys(userStore[userId]).length}个平台，${totalAccounts}个账号`;
        return s.reply(result);
    }
    
    // 查询指定平台
    const queryMatch = msg.match(/^账号查询\s+(\S+)$/);
    if (queryMatch) {
        const platform = queryMatch[1];
        
        if (!userStore[userId][platform] || Object.keys(userStore[userId][platform]).length === 0) {
            return s.reply(`❌ 平台【${platform}】没有保存账号`);
        }
        
        const accounts = userStore[userId][platform];
        let result = `🔒 平台: ${platform}\n\n`;
        
        for (const acc in accounts) {
            const data = accounts[acc];
            
            if (isPrivateChat) {
                result += `账号: ${acc}\n密码: ${decrypt(data.password)}\n分类: ${data.tag}\n保存: ${new Date(data.savedAt).toLocaleString()}\n`;
                
                if (data.history.length > 0) {
                    result += `\n🕒 历史记录 (${data.history.length}条):\n`;
                    data.history.forEach((h, i) => {
                        result += `  ${i + 1}. 密码: ${decrypt(h.password)}\n     时间: ${new Date(h.updatedAt).toLocaleString()}\n`;
                    });
                }
                result += '\n';
            } else {
                result += `账号: ${acc}\n分类: ${data.tag}\n保存: ${new Date(data.savedAt).toLocaleString()}\n（密码仅私聊显示）\n\n`;
            }
        }
        
        return s.reply(result);
    }
    
    // 账号删除
    const deleteMatch = msg.match(/^账号删除\s+(\S+)\s+(\S+)$/);
    if (deleteMatch) {
        const platform = deleteMatch[1];
        const account = deleteMatch[2];
        
        if (userStore[userId][platform] && userStore[userId][platform][account]) {
            delete userStore[userId][platform][account];
            
            // 如果平台没有账号了，删除平台
            if (Object.keys(userStore[userId][platform]).length === 0) {
                delete userStore[userId][platform];
            }
            
            saveUserData(userId);
            return s.reply(`🗑️ 账号已删除\n平台: ${platform}\n账号: ${account}\n（包括所有历史记录）`);
        } else {
            return s.reply(`❌ 账号不存在\n平台: ${platform}\n账号: ${account}`);
        }
    }
    
    // 数据导出
    if (msg === '账号导出') {
        if (Object.keys(userStore[userId]).length === 0) {
            return s.reply(`❌ 没有账号数据可导出`);
        }
        
        const exportData = JSON.stringify(userStore[userId], null, 2);
        return s.reply(`📋 账号数据导出:\n\`\`\`json\n${exportData}\n\`\`\`\n\n💡 复制上面的JSON数据，可用于导入到其他地方`);
    }
    
    // 数据导入
    const importMatch = msg.match(/^账号导入\s+(.+)$/);
    if (importMatch) {
        try {
            const importData = JSON.parse(importMatch[1]);
            userStore[userId] = importData;
            saveUserData(userId);
            
            // 统计导入数据
            let totalPlatforms = Object.keys(importData).length;
            let totalAccounts = 0;
            for (const platform in importData) {
                totalAccounts += Object.keys(importData[platform]).length;
            }
            
            return s.reply(`✅ 数据导入成功\n📊 导入了 ${totalPlatforms} 个平台的 ${totalAccounts} 个账号`);
        } catch (error) {
            return s.reply(`❌ 导入失败\n原因: JSON格式错误\n${error.message}`);
        }
    }
    
    // 帮助信息
    if (msg === '账号帮助') {
        return s.reply(`📖 账号助手 v1.2.0 使用说明

━━━━━━━━ 📋 命令列表 ━━━━━━━━
1️⃣ 账号保存 平台名 账号 密码 [分类]
2️⃣ 账号查询 - 查看所有平台账号
3️⃣ 账号查询 平台名 - 查看指定平台
4️⃣ 账号删除 平台名 账号
5️⃣ 账号导出 - 导出所有数据
6️⃣ 账号导入 JSON数据 - 导入数据

━━━━━━━━ 📝 使用示例 ━━━━━━━━
• 账号保存 微信 myuser 123456 个人
• 账号保存 QQ 123456789 password 工作
• 账号查询 - 查看所有
• 账号查询 微信 - 查看微信账号
• 账号删除 QQ 123456789

━━━━━━━━ 🔒 安全特性 ━━━━━━━━
• 密码AES加密存储
• 群聊安全：不显示密码
• 私聊完整：显示密码和历史
• 智能去重：相同密码不重复记录
• 数据隔离：每用户独立文件
• 历史追踪：密码修改记录

━━━━━━━━ 💡 使用提示 ━━━━━━━━
• 建议在私聊中使用
• 定期导出备份数据
• 平台名保持一致避免重复
• 分类标签便于管理`);
    }
    
    // 未知命令
    return s.reply(`❓ 未知命令\n发送"账号帮助"查看详细说明`);
};
