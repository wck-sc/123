const catalog = require('./data/catalog.json');
const {json,errorReply,callModel}=require('./_common');
const pats={
  '电视':/电视|OLED|MiniLED/i,'冰箱':/冰箱/,'洗衣机':/洗衣机/,'烘干机':/烘干机/,'洗烘套装':/洗烘套装|洗烘/,'洗烘一体机':/洗烘一体机/,
  '油烟机':/油烟机|烟机/,'燃气灶':/燃气灶/,'洗碗机':/洗碗机/,'空调':/空调/,'中央空调':/中央空调/,'卧室空调':/空调/,'立式空调':/立式空调|柜机/,
  '热水器':/热水器/,'智能马桶':/智能马桶|智能坐便/,'扫地机器人':/扫地机器人/,'净水器':/净水器/,'智能门锁':/智能锁|门锁/,'浴霸':/浴霸/,'蒸烤箱':/蒸烤/,'电吹风':/吹风机|电吹风/,'音箱':/音箱|音响/,'灯具':/灯具|照明/
};
const budgetAllow=[80000,100000,120000,140000,168000];
function candidatesFor(chosen){
  const all=[...new Set([...chosen,...Object.keys(pats)])];
  const seen=new Set(),rows=[];
  for(const cat of all){const regex=pats[cat];if(!regex)continue;let n=0;
    for(const item of catalog){if(n>=2)break;if(regex.test(item.name)&&!seen.has(item.sku)){seen.add(item.sku);rows.push({category:cat,sku:item.sku,name:item.name,url:item.url});n++;}}
  }return rows;
}
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'只支持 POST'});
  if(!process.env.DEEPSEEK_API_KEY)return json(503,{error:'尚未在 Netlify 配置 DEEPSEEK_API_KEY'});
  if((event.body||'').length>18000)return json(413,{error:'请求数据过大'});
  try{
    const b=JSON.parse(event.body||'{}');
    const message=String(b.message||'').trim();if(!message||message.length>2000)return json(400,{error:'请输入 1—2000 字的需求'});
    const selected=Array.isArray(b.selected)?b.selected.filter(x=>typeof x==='string'&&x.length<=20).slice(0,50):[];
    const budget=budgetAllow.includes(Number(b.budget))?Number(b.budget):168000;
    const house=String(b.house||'三室一厅一卫').slice(0,30),city=String(b.city||'未填写').slice(0,40);
    const layout=JSON.stringify(b.layout||null).slice(0,2000);
    const candidates=candidatesFor(selected);
    const system=`你是京东全屋家电选购顾问，资深导购风格，专业、温和、直接。不使用生硬 AI 口吻，不要反复追问；客户几个关键词即可生成可复制的完整方案。
房屋：${house}；城市：${city}；客户预算上限：${budget}元；客户已选择品类：${selected.join('、')||'默认全屋推荐'}；户型图识别信息：${layout}。
预算只能是 8万、10万、12万、14万、16.8万，最高不可超过16.8万。优先尊重用户明确说的五档预算；不能因为客户说过16.8万就任意扩大预算。用户说16万元可按16.8万元封顶、以16万元作为目标；需说明。
你的工作：用清晰中文输出详细而不冗余的可复制方案，先摘要，然后按玄关、客厅、卧室(逐间)、厨房、卫生间(逐间)、阳台分组，列出配置品类、推荐数量、品类预算、小计及选购理由；最终列出预算小计与合计、预留金额、安装尺寸和电路水路核对事项。主卧/次卧数量决定空调、照明数量；卫生间数量决定马桶和浴霸数量，洗衣/烘干默认放阳台，若用户明确提出也可放卫生间；整屋家电考虑电视、空调(中央或分体二选一)、灯具、音箱、扫地机、冰箱、烟灶、洗碗机、蒸烤箱、净水器、热水器、智能马桶、洗烘方案、门锁与智能控制等。中央空调不能和全部分体空调重复计费，洗烘套装、洗烘一体机与洗衣机+烘干机为不同选项不能重复计费。
关于目录：以下仅为店铺626条部分目录的真实候选SKU，目录没有实时价格、库存、上门安装范围、真实尺寸。只允许引用候选列表中的SKU/链接；不要杜撰商品、价格、库存、补贴；匹配不到就写'本店目录暂未匹配，待导购核实'。必须把金额标成'品类预算建议（非实时售价/成交报价）'，各品类分配合计不得超过客户预算，存在预留金时说明。商品不要在页面底部罗列，只在方案内引用少量最相关SKU，不要把整个数据库复制出来。
选购顾问应提醒：若模型参数或价格未核实，应让导购确认之后再下单。不要索要电话、手机号、微信号或住址等私人信息。
真实候选SKU：${JSON.stringify(candidates).slice(0,20500)}`;
    const history=Array.isArray(b.history)?b.history.slice(-8).filter(x=>x && (x.role==='user'||x.role==='assistant')&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,2500)})):[];
    const result=await callModel([{role:'system',content:system},...history,{role:'user',content:message}],{maxTokens:3900,timeoutMs:46000});
    if(result.status!==200)return result.status?errorReply(result.status):json(504,{error:result.reason||'连接上游超时'});
    if(!result.content.trim())return json(502,{error:'AI 返回了空内容，请重试'});
    return json(200,{answer:result.content,provider:'DeepSeek'});
  }catch(e){return json(500,{error:'请求处理失败，请检查输入后重试'});}
};
