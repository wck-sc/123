'use strict';
const $=id=>document.getElementById(id);
const ROOMS=['全屋','客厅','厨房','卧室','卫生间','阳台','玄关'];
const PRODUCTS={
  '客厅':['电视','中央空调','立式空调','扫地机器人','音箱','客厅灯具','空气净化器','智能窗帘'],
  '厨房':['冰箱','油烟机','燃气灶','洗碗机','蒸烤箱','净水器','微波炉','厨房灯具','垃圾处理器'],
  '卧室':['卧室空调','卧室灯具','空气净化器','智能窗帘'],
  '卫生间':['智能马桶','热水器','浴霸','卫生间灯具','电吹风'],
  '阳台':['洗烘套装','洗烘一体机','洗衣机','烘干机','阳台灯具'],
  '玄关':['智能门锁','玄关灯具','智能开关']
};
let room='全屋',category='客厅',budget=168000,layout=null,floorImage=null,uploadSerial=0,activeFile=null,agentReady=false,sending=false;
const selected=new Set(),history=[];
let toastTimer=null;
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2700)}
function syncRooms(){
  $('sceneRooms').replaceChildren();for(const r of ROOMS){const b=document.createElement('button');b.textContent=r;b.type='button';b.classList.toggle('active',r===room);b.onclick=()=>{room=r;syncRooms();goRoom(r)};$('sceneRooms').append(b)}
  $('categoryTabs').replaceChildren();for(const r of ROOMS.slice(1)){const b=document.createElement('button');b.textContent=r;b.type='button';b.classList.toggle('active',r===category);b.onclick=()=>{category=r;syncRooms();syncProducts()};$('categoryTabs').append(b)}
}
function goRoom(name){const frame=$('vrFrame');try{const win=frame.contentWindow;if(typeof win.setRoomCamera==='function')win.setRoomCamera(name)}catch(e){}}
function syncProducts(){const node=$('goodsList');node.replaceChildren();for(const product of PRODUCTS[category]){let key=category+':'+product,row=document.createElement('div'),label=document.createElement('span'),btn=document.createElement('button');row.className='good-row';label.textContent=product;btn.type='button';const picked=selected.has(key);btn.className=picked?'selected':'';btn.textContent=picked?'已选 ✓':'＋ 添加';btn.onclick=()=>{if(selected.has(key)){selected.delete(key)}else{selected.add(key)}syncProducts()};row.append(label,btn);node.append(row)}$('selectedCount').textContent='已选 '+selected.size+' 项'}
function setBudget(value){const next=Number(value);if(![80000,100000,120000,140000,168000].includes(next))return;budget=next;$('budgetAmount').textContent=(budget/10000).toLocaleString('zh-CN')+' 万元';document.querySelectorAll('[data-budget]').forEach(b=>b.classList.toggle('active',Number(b.dataset.budget)===budget))}
function detectBudget(text){const m=text.match(/(?:预算|预算约|总预算|预算是|控制在)?\s*(16\.8|16万8|十六点八|14|十四|12|十二|10|十|8|八)\s*万(?:元)?/);if(!m)return;const v={'16.8':168000,'16万8':168000,'十六点八':168000,'14':140000,'十四':140000,'12':120000,'十二':120000,'10':100000,'十':100000,'8':80000,'八':80000}[m[1]];if(v)setBudget(v)}
function detectHouse(text){const normalized=text.replace(/两/g,'二');const match=normalized.match(/[一二三四1234]室[一二12]厅[一二12]卫/);if(match){const value=match[0].replace(/[1-4]/g,x=>({1:'一',2:'二',3:'三',4:'四'}[x]));if([...$('house').options].some(o=>o.value===value))$('house').value=value}}
function setAgentState(ready){agentReady=ready;$('agentText').textContent=ready?'智能导购在线':'导购服务暂不可用';$('agentStatus').classList.toggle('error',!ready)}
async function checkStatus(){try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('接口状态异常');const d=await r.json();setAgentState(d.ready===true)}catch(e){setAgentState(false)}}
async function callApi(endpoint,payload,timeout=58000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch('/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});let data;try{data=await r.json()}catch(e){throw Error('接口返回内容异常，请重试')}if(!r.ok)throw Error(data.error||'服务暂不可用（'+r.status+'）');return data}finally{clearTimeout(timer)}}
function bubble(text,type='bot'){const el=document.createElement('div');el.className='bubble '+type;el.textContent=text;$('messages').append(el);scrollChat();return el}
function scrollChat(){$('messages').scrollTop=$('messages').scrollHeight}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inlineMD(text){let safe=escapeHtml(text);safe=safe.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');safe=safe.replace(/(https:\/\/item\.jd\.com\/\d+\.html)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">京东商品链接</a>');return safe}
function renderMarkdown(md){const lines=String(md||'').replace(/\r\n/g,'\n').split('\n');const out=[];let liMode=null;
 function closeList(){if(liMode){out.push('</'+liMode+'>');liMode=null}};
 for(let i=0;i<lines.length;i++){
  const raw=lines[i].trim();if(!raw){closeList();continue}
  const tableCandidate=raw.startsWith('|')&&raw.endsWith('|');
  if(tableCandidate&&i+1<lines.length&&/^\|?[\s:|-]+\|?$/.test(lines[i+1].trim())&&lines[i+1].includes('-')){
   closeList();const cols=s=>s.replace(/^\||\|$/g,'').split('|').map(x=>x.trim());out.push('<table><thead><tr>'+cols(raw).map(c=>'<th>'+inlineMD(c)+'</th>').join('')+'</tr></thead><tbody>');i+=2;
   for(;i<lines.length;i++){const row=lines[i].trim();if(!row.startsWith('|'))break;out.push('<tr>'+cols(row).map(c=>'<td>'+inlineMD(c)+'</td>').join('')+'</tr>')}
   out.push('</tbody></table>');i--;continue;
  }
  const head=raw.match(/^(#{1,4})\s+(.*)$/);if(head){closeList();const tag=head[1].length<=2?'h2':'h3';out.push('<'+tag+'>'+inlineMD(head[2])+'</'+tag+'>');continue}
  const bullet=raw.match(/^[-*•]\s+(.*)$/),numbered=raw.match(/^\d+[.)、]\s+(.*)$/);if(bullet||numbered){const kind=bullet?'ul':'ol';if(liMode!==kind){closeList();out.push('<'+kind+'>');liMode=kind}out.push('<li>'+inlineMD((bullet||numbered)[1])+'</li>');continue}
  closeList();out.push('<p>'+inlineMD(raw)+'</p>');
 }
 closeList();return out.join('')}
async function copyToClipboard(s){try{await navigator.clipboard.writeText(s);toast('方案已复制')}catch(e){const textarea=document.createElement('textarea');textarea.value=s;textarea.style.position='fixed';textarea.style.left='-9999px';document.body.append(textarea);textarea.select();const done=document.execCommand('copy');textarea.remove();toast(done?'方案已复制':'请长按内容复制')}}
function addAIAnswer(text){const el=document.createElement('article');el.className='bubble bot';const content=document.createElement('div');content.className='reply-body';content.innerHTML=renderMarkdown(text);const actions=document.createElement('div');actions.className='reply-actions';const copy=document.createElement('button');copy.type='button';copy.className='mini-action';copy.textContent='复制完整方案';copy.onclick=()=>copyToClipboard(text);const download=document.createElement('button');download.type='button';download.className='mini-action';download.textContent='保存文本';download.onclick=()=>{const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='全屋家电选购方案.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)};actions.append(copy,download);el.append(content,actions);$('messages').append(el);scrollChat()}
async function send(text){const message=(text||$('chatInput').value||'').trim();if(!message||sending)return;if(message.length>2000){toast('需求请控制在 2000 字以内');return}detectBudget(message);detectHouse(message);$('chatInput').value='';bubble(message,'user');sending=true;$('sendButton').disabled=true;const loading=bubble('正在为您整理全屋配置方案…','bot loading');try{const data=await callApi('chat',{message,history:history.slice(-8),house:$('house').value,city:$('city').value,budget,selected:[...selected].map(k=>k.split(':').slice(1).join(':')),layout},59000);loading.remove();if(!data.answer)throw Error('智能导购暂时没有返回方案');setAgentState(true);addAIAnswer(data.answer);history.push({role:'user',content:message},{role:'assistant',content:data.answer});if(history.length>16)history.splice(0,history.length-16)}catch(e){loading.textContent='这次没有成功获取方案：'+(e.name==='AbortError'?'请求超时':e.message)+'。您可以稍后重试。'}finally{sending=false;$('sendButton').disabled=false}}
function setUploadBusy(busy,msg){$('floorProgress').textContent=msg||'';$('floorProgress').classList.toggle('is-busy',busy);$('replaceButton').disabled=busy;$('retryButton').disabled=busy}
function readImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const cap=1700,scale=Math.min(1,cap/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',.86))}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图片无法读取'))};img.src=url})}
function sendFloorTo3D(){if(!layout)return;try{const iframe=$('vrFrame');iframe.contentWindow.postMessage({type:'JD_FLOORPLAN',layout},location.origin)}catch(e){}}
$('vrFrame').addEventListener('load',()=>{if(layout)sendFloorTo3D()});
function resetToDemo(){layout=null;room='全屋';syncRooms();$('vrFrame').src='scene.html?embed=1&reset='+Date.now();$('vrTag').textContent='3D 样板房';$('sceneNote').textContent='未上传户型图，当前展示样板房。'}
function clearFloor(){uploadSerial++;floorImage=null;activeFile=null;$('floorInput').value='';$('floorThumb').removeAttribute('src');$('uploadFilled').hidden=true;$('uploadEmpty').hidden=false;$('retryButton').hidden=true;setUploadBusy(false,'');resetToDemo();toast('已删除户型图，恢复默认 3D 样板房')}
async function analyzeFloor(serial){if(!floorImage||serial!==uploadSerial)return;setUploadBusy(true,'正在根据户型图识别房间，并构建 3D 概念空间…');$('fileMeta').textContent='识别中…';$('retryButton').hidden=true;
 try{const result=await callApi('floorplan',{image:floorImage},59000);if(serial!==uploadSerial)return;if(!result.layout?.rooms?.length)throw Error('没有识别到可用的房间');layout=result.layout;sendFloorTo3D();$('vrTag').textContent='您的户型 · AI 概念建模';const labels=layout.rooms.map(x=>x.name).filter(Boolean);$('sceneNote').textContent='参考图纸识别：'+labels.slice(0,7).join('、')+(labels.length>7?'等':'')+'。';$('fileMeta').textContent='已生成 3D 概念预览';setUploadBusy(false,'户型识别完成。墙体、房间比例和尺寸为近似值，安装前请核实。');if(result.house&&[...$('house').options].some(o=>o.value===result.house))$('house').value=result.house;setAgentState(true);bubble('已结合您上传的户型图识别出 '+labels.join('、')+'。3D 预览已更新，我会把这些空间信息用于后续家电方案；具体尺寸仍需核实。')}
 catch(e){if(serial!==uploadSerial)return;$('fileMeta').textContent='识别未完成';$('retryButton').hidden=false;setUploadBusy(false,'识别未成功：'+(e.name==='AbortError'?'请求超时':e.message)+'。可以重试或替换更清晰的户型图。');$('sceneNote').textContent='当前仍为样板房，尚未生成您的专属户型。'}
}
async function chooseFloor(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('请选择 JPG、PNG 或 WebP 图片');return}if(file.size>8*1024*1024){toast('图纸请小于 8MB');return}
 const serial=++uploadSerial;activeFile=file;floorImage=null;layout=null;resetToDemo();$('uploadEmpty').hidden=true;$('uploadFilled').hidden=false;$('fileName').textContent=file.name;$('fileMeta').textContent='准备分析';setUploadBusy(true,'正在读取户型图…');try{floorImage=await readImage(file);if(serial!==uploadSerial)return;$('floorThumb').src=floorImage;await analyzeFloor(serial)}catch(e){if(serial===uploadSerial){setUploadBusy(false,'图片读取失败，请替换后重试');$('retryButton').hidden=false}}}
function init(){syncRooms();syncProducts();checkStatus();document.querySelectorAll('[data-budget]').forEach(b=>b.onclick=()=>setBudget(b.dataset.budget));
 $('openWechat').onclick=()=>{$('wechatModal').hidden=false};$('closeWechat').onclick=()=>{$('wechatModal').hidden=true};$('wechatModal').onclick=e=>{if(e.target===$('wechatModal'))$('wechatModal').hidden=true};document.addEventListener('keydown',e=>{if(e.key==='Escape')$('wechatModal').hidden=true});
 $('uploadButton').onclick=()=>$('floorInput').click();$('replaceButton').onclick=()=>$('floorInput').click();$('deleteButton').onclick=clearFloor;$('retryButton').onclick=()=>analyzeFloor(uploadSerial);$('floorInput').onchange=e=>{const f=e.target.files?.[0];if(f)chooseFloor(f)};
 $('sendButton').onclick=()=>send();$('chatInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.prompt));$('generateSelected').onclick=()=>send(selected.size?'请优先按右侧勾选的家电品类，结合我的户型和预算直接生成详细全屋方案，说明数量及金额，不需要列出所有商品。':'请结合我的户型和预算，直接生成一套详细的全屋家电选购方案，包括各空间家电、数量与预算分配。');
}
document.addEventListener('DOMContentLoaded',init);
