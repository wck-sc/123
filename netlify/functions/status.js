const {json}=require('./_common');exports.handler=async()=>json(200,{ready:!!process.env.DEEPSEEK_API_KEY,provider:'DeepSeek',note:'ready 仅代表已配置环境变量，并不代表 API 已实际连通'});
