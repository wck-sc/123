function json(status,data){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
export function onRequestGet({env}) {
  return json(200,{ready:!!env.DEEPSEEK_API_KEY,provider:'DeepSeek',note:'ready 仅表示密钥已配置，不代表模型可用或账号有余额'});
}
