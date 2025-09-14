/**
 * @author Air
 * @team 阳光
 * @name 定时伪装消息
 * @version 2.1.0
 * @description 多平台定时伪装消息，支持多任务管理和定时发送
 * @rule ^定时伪装$
 * @rule ^清理任务$
 * @rule ^清理任务\s+(.+)$
 * @rule ^伪装消息\s+(.+)$
 * @rule ^任务列表$
 * @rule ^伪装消息帮助$
 * @admin false
 * @priority 10
 * @public true
 * @encrypt false
 * @disable false
 * @systemVersion >=:2.0.5
 * @authentication false
 * @classification ["工具", "定时", "消息"]
 */

const schedule = require('node-schedule');

// 配置结构简化
const jsonSchema = BncrCreateSchema.object({        
    tasks: BncrCreateSchema.array(BncrCreateSchema.object({
        name: BncrCreateSchema.string().setTitle('任务名称').setDefault('早安任务'),
        enable: BncrCreateSchema.boolean().setTitle('启用任务').setDefault(true),
        cron: BncrCreateSchema.string().setTitle('定时规则').setDefault("0 9 * * *").setDescription("如: 0 9 * * * 表示每天9点"),
        message: BncrCreateSchema.string().setTitle('消息内容').setDefault("早安~").setDescription("要发送的消息内容"),
        targets: BncrCreateSchema.array(BncrCreateSchema.object({
            platform: BncrCreateSchema.string()
                .setTitle('平台')
                .setEnum(['tgBot', 'qq', 'wechaty', 'wxWork', 'HumanTG'])
                .setEnumNames(['TG机器人', 'QQ', '微信', '企业微信', '人形TG'])
                .setDefault('tgBot'),
            userId: BncrCreateSchema.string().setTitle('用户ID'),
            groupId: BncrCreateSchema.string().setTitle('群ID').setDefault('').setDescription('私聊留空'),
            remark: BncrCreateSchema.string().setTitle('备注').setDefault('').setDescription('方便识别的备注')
        })).setTitle('推送目标')
    })).setTitle("🎭 定时伪装消息推送 v2.0 - 阳光多任务版").setDescription("")
});

const ConfigDB = new BncrPluginConfig(jsonSchema);
let jobs = new Map();

// 配置常量
const PLATFORMS = {
    'tgBot': 'TG机器人', 'qq': 'QQ', 'wechaty': '微信',
    'wxWork': '企业微信', 'HumanTG': '人形TG'
};

// 工具函数
const sendFakeMessage = (platform, userId, groupId, message) => {
    const msgInfo = { type: 'text', msg: message, userId, groupId: groupId || '0' };
    sysMethod.Adapters(msgInfo, platform, 'inlinemask', msgInfo);
    console.log(`🎭 [${PLATFORMS[platform]}] ${userId}${groupId ? `@群${groupId}` : '@私聊'}: ${message}`);
};

const parseFakeArgs = (argStr) => {
    const args = argStr.trim().split(/\s+/);
    
    if (args.length === 1 || !Object.keys(PLATFORMS).includes(args[0])) {
        return { type: 'current', message: argStr };
    }
    if (args.length === 3) {
        return { type: 'private', platform: args[0], userId: args[1], message: args.slice(2).join(' ') };
    }
    if (args.length >= 4) {
        return { type: 'group', platform: args[0], userId: args[1], groupId: args[2], message: args.slice(3).join(' ') };
    }
    return null;
};

module.exports = async (s) => {
    const msg = s.getMsg().trim();
    
    // 伪装消息帮助
    if (msg === '伪装消息帮助') {
        return s.reply(`📖 伪装消息详细帮助

━━━━━━━━ 📋 命令列表 ━━━━━━━━
  🔄 定时伪装 —— 启动所有配置的任务
  📋 任务列表 —— 查看所有任务状态
  🧹 清理任务 —— 清理所有任务
  🧹 清理任务 任务名称 —— 清理指定任务
  ✉️ 伪装消息 内容 —— 当前会话测试
  ✉️ 伪装消息 平台 用户ID 内容 —— 私聊伪装
  ✉️ 伪装消息 平台 用户ID 群ID 内容 —— 群聊伪装

━━━━━━━━ 📝 示例 ━━━━━━━━
  📋 伪装小例子（注意：只会运行一次，重复定时请在插件配置中设置定时任务）
  1️⃣ 伪装消息 tgBot 123456789 time
  2️⃣ 伪装消息 tgBot 123456789 987654321 time

━━━━━━━━ ⚙️ 使用流程 ━━━━━━━━
  1️⃣ 在插件配置中设置定时任务
  2️⃣ 发送「定时伪装」启动任务
  🛑 当不再需要伪装消息时，可发送「清理任务」停止任务

━━━━━━━━ 💡 提示 ━━━━━━━━
  🌐 支持平台: TG机器人、QQ、微信、企业微信、人形TG
  💡 重启后需重新发送「定时伪装」启动任务
  ⚠️ 记得安装模块 npm i node-schedule

━━━━━━━━ 🔧 适配器脚本 ━━━━━━━━
  // 企业微信适配器
  wxWork.inlinemask = async function (msgInfo) {
      return wxWork.receive(msgInfo);
  };

  // QQ适配器
  qq.inlinemask = async function (msgInfo) {
      return qq.receive(msgInfo);
  };

  // TG适配器
  tg.inlinemask = async function (msgInfo) {
      return tg.receive(msgInfo);
  };`);
    }
    
    // 伪装消息功能
    if (msg.startsWith('伪装消息 ')) {
        const argStr = msg.replace('伪装消息 ', '');
        const parsed = parseFakeArgs(argStr);
        
        if (!parsed) {
            return s.reply(`❌ 参数格式错误，发送"伪装消息帮助"查看详细说明`);
        }
        
        try {
            let platform, userId, groupId, message;
            
            if (parsed.type === 'current') {
                platform = s.getFrom();
                userId = s.getUserId();
                groupId = s.getGroupId();
                message = parsed.message;
            } else {
                platform = parsed.platform;
                userId = parsed.userId;
                groupId = parsed.type === 'group' ? parsed.groupId : '';
                message = parsed.message;
            }
            
            if (!PLATFORMS[platform]) {
                return s.reply(`❌ 不支持的平台: ${platform}\n🌐 支持: ${Object.keys(PLATFORMS).join(' ')}`);
            }
            
            sendFakeMessage(platform, userId, groupId, message);
            const target = groupId ? `群聊(${groupId})` : '私聊';
            return s.reply(`✅ 伪装消息发送成功\n🌐 ${PLATFORMS[platform]} • ${userId} (${target})\n💬 ${message}`);
            
        } catch (error) {
            return s.reply(`❌ 发送失败: ${error.message}`);
        }
    }
    
    // 清理指定任务
    const clearMatch = msg.match(/^清理任务\s+(.+)$/);
    if (clearMatch) {
        const taskName = clearMatch[1];
        if (jobs.has(taskName)) {
            jobs.get(taskName).cancel();
            jobs.delete(taskName);
            return s.reply(`🧹 任务"${taskName}"已清理`);
        }
        return s.reply(`❌ 找不到任务"${taskName}"\n发送"任务列表"查看所有任务`);
    }
    
    // 清理所有任务
    if (msg === '清理任务') {
        const count = jobs.size;
        jobs.forEach(job => job.cancel());
        jobs.clear();
        return s.reply(count > 0 ? `🧹 已清理所有任务 (${count}个)` : '💡 当前没有运行中的任务');
    }
    
    // 任务列表
    if (msg === '任务列表') {
        if (jobs.size === 0) {
            return s.reply('📋 当前没有运行中的任务\n💡 发送"定时伪装"启动任务');
        }
        
        let reply = `📋 运行中的任务 (${jobs.size}个):\n\n`;
        let index = 1;
        jobs.forEach((job, name) => {
            const nextTime = job.nextInvocation();
            reply += `${index}. ${name}\n⏭️ 下次: ${nextTime ? nextTime.toLocaleString('zh-CN') : '已完成'}\n\n`;
            index++;
        });
        reply += `💡 使用"清理任务 任务名"清理指定任务`;
        return s.reply(reply);
    }
    
    // 定时伪装启动
    if (msg === '定时伪装') {
        try {
            await ConfigDB.get();
            const { tasks } = ConfigDB.userConfig;
            
            if (!tasks?.length) {
                return s.reply('⚠️ 请先配置定时任务\n💡 点击下方按钮进行配置');
            }
            
            // 清理旧任务
            jobs.forEach(job => job.cancel());
            jobs.clear();
            
            let started = 0, skipped = [];
            
            tasks.forEach(task => {
                if (!task.enable) {
                    skipped.push(`${task.name} (已禁用)`);
                    return;
                }
                
                if (!task.targets?.length) {
                    skipped.push(`${task.name} (无目标)`);
                    return;
                }
                
                try {
                    const job = schedule.scheduleJob(task.cron, () => {
                        console.log(`⏰ 执行任务"${task.name}": ${task.message}`);
                        task.targets.forEach(target => {
                            sendFakeMessage(target.platform, target.userId, target.groupId, task.message);
                        });
                    });
                    
                    jobs.set(task.name, job);
                    started++;
                } catch (error) {
                    skipped.push(`${task.name} (规则错误)`);
                }
            });
            
            let reply = `✅ 启动完成: ${started}个任务\n`;
            if (skipped.length) {
                reply += `⚠️ 跳过: ${skipped.join('、')}\n`;
            }
            
            if (started > 0) {
                reply += `\n📋 运行中任务:\n`;
                jobs.forEach((job, name) => {
                    const task = tasks.find(t => t.name === name);
                    const nextTime = job.nextInvocation();
                    reply += `• ${name} (${task.targets.length}个目标)\n  ⏰ ${task.cron} | ⏭️ ${nextTime?.toLocaleString('zh-CN')}\n`;
                });
            }
            
            return s.reply(reply);
            
        } catch (error) {
            return s.reply(`❌ 启动失败: ${error.message}`);
        }
    }
    
    // 默认帮助
    return s.reply(HELP_TEXT);
};
