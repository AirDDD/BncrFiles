/**
 * @author Air
 * @team Air
 * @name 记账本
 * @version 1.0.0
 * @description 单用户按月记账，支持查询当日、当月、指定月份、最近7天，并统计收入/支出/余额，记录精确时间
 * @rule ^(jz|记账)\s+([+-]?\d+(?:\.\d+)?)\s*(.*)$
 * @rule ^查询(当日|当月|\d{4}|七天)$
 * @rule ^记账帮助$
 * @priority 10
 * @admin false
 * @public true
 * @disable false
 * @classification ["Air"]
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '账本');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

// 获取当月文件
const getMonthFile = (monthStr) => path.join(baseDir, `${monthStr}.json`);
const today = new Date();

// 获取年月日
function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear().toString().slice(2)}${mm}-${dd}`;
}

// 获取完整时间 yyyy-MM-dd hh:mm:ss
function formatDateTime(d) {
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
}

function loadMonth(monthStr) {
  const file = getMonthFile(monthStr);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } 
  catch { return []; }
}

function saveMonth(monthStr, data) {
  fs.writeFileSync(getMonthFile(monthStr), JSON.stringify(data, null, 2));
}

function calcStats(records) {
  let income = 0, expense = 0;
  records.forEach(r => {
    if (r.amount > 0) income += r.amount;
    else expense += r.amount;
  });
  const balance = income + expense;
  return { income, expense, balance };
}

module.exports = async s => {
  const msg = s.msgInfo.msg.trim();

  // ==== 记账命令 ====
    let match = msg.match(/^(jz|记账)\s+([+-]?\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
     const amount = parseFloat(match[2]);
     const note = match[3] || '';
     const now = new Date(); // ✅ 每次记账都获取新的时间
     const monthStr = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
     const monthData = loadMonth(monthStr);
      monthData.push({ 
       datetime: formatDateTime(now), // 使用新的时间
       amount, 
       note 
      });
    saveMonth(monthStr, monthData);
     await s.reply(`✅ 已记账：${amount} ${note}`);
     return;
    }

  // ==== 查询命令 ====
  match = msg.match(/^查询(当日|当月|\d{4}|七天)$/);
  if (match) {
    const query = match[1];
    let results = [];

    if (query === '当日') {
      const monthStr = String(today.getFullYear()).slice(2) + String(today.getMonth() + 1).padStart(2, '0');
      const monthData = loadMonth(monthStr);
      const todayStr = formatDate(today);
      results = monthData.filter(r => r.datetime.startsWith(todayStr));
    } else if (query === '当月') {
      const monthStr = String(today.getFullYear()).slice(2) + String(today.getMonth() + 1).padStart(2, '0');
      results = loadMonth(monthStr);
    } else if (query === '七天') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
        const monthStr = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = formatDate(d);
        const monthData = loadMonth(monthStr);
        monthData.filter(r => r.datetime.startsWith(dayStr)).forEach(r => results.push(r));
      }
    } else {
      // 指定月份查询，如 2509
      const monthStr = query;
      results = loadMonth(monthStr);
    }

    if (!results.length) {
      await s.reply('暂无记录');
      return;
    }

    const stats = calcStats(results);
    const recordText = results.map(r => `${r.datetime} ${r.amount} ${r.note}`).join('\n');
    const statText = `\n📊 收入: ${stats.income.toFixed(2)} 支出: ${stats.expense.toFixed(2)} 余额: ${stats.balance.toFixed(2)}`;
    await s.reply(recordText + statText);
    return;
  }

  // ==== 帮助命令 ====
  if (/^记账帮助$/.test(msg)) {
    const helpText = `
📒 记账本帮助
1. 记账：
   jz +50 吃饭
   记账 +50 吃饭
2. 查询：
   查询当日
   查询当月
   查询2509（指定月份）
   查询7天（最近7天）
3. 数据按月存储在账本文件夹，每月一个JSON文件，如2509.json
查询结果会显示总收入/总支出/余额，并显示每条记录的具体时间
`;
    await s.reply(helpText.trim());
    return;
  }

  // ==== 查询时间命令 ====
  if (/^time$/.test(msg)) {
    await s.reply(formatDateTime(new Date()));
    return;
  }
};
