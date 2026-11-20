const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-flash';
const json = (statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
function errorReply(status, data){
  if(status===401) return json(502,{error:'DeepSeek API Key 无效，请检查 Netlify 环境变量是否已更新。'});
  if(status===402) return json(402,{error:'DeepSeek API 账户余额或免费额度不足；请先到 DeepSeek 平台核实，不要盲目充值。'});
  if(status===429) return json(429,{error:'请求过于频繁，稍后重试。'});
  return json(502,{error:'DeepSeek 暂时未能响应（HTTP '+status+'），请检查 API 状态与额度。'});
}
async function callModel(messages, {jsonMode=false,maxTokens=3300,timeoutMs=45000}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(API_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.DEEPSEEK_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages,thinking:{type:'disabled'},stream:false,max_tokens:maxTokens,...(jsonMode?{response_format:{type:'json_object'}}:{})}),signal:controller.signal});
    if(!res.ok) return {status:res.status};
    const raw=await res.json();return {status:200,content:raw.choices?.[0]?.message?.content||''};
  }catch(e){return {status:0,reason:e.name==='AbortError'?'上游响应超时':'网络请求失败'};}
  finally{clearTimeout(timer)}
}
module.exports={json,errorReply,callModel};
