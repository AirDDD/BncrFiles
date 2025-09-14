/**
 * @author Air
 * @team Air
 * @name 黑丝
 * @version 1.0.0
 * @description 发送“黑丝”后自动获取视频
 * @rule ^黑丝$
 * @priority 10
 * @admin false
 * @public true
 * @encrypt false
 * @disable false
 * @classification ["视频"]
 */


const got = require('got');

module.exports = async s => {
    const apiUrl = 'https://api.yujn.cn/api/heisis.php?type=json';
    const response = await got(apiUrl);
    const data = JSON.parse(response.body);
    const videoUrl = data.data.trim();
    await s.reply({
      type: 'video',
      path: videoUrl,
    });
};
