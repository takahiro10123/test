const app = document.getElementById('app');
const S={phase:'setup',yellowCount:2,redCount:1,deck:[],stands:[[],[],[],[]],current:0,turn:1,miss:0,hints:[null,null],hintPhase:0,action:'normal',selectedSelf:null,selectedOpp:[],abilityUsed:[false,false],overlay:null,result:null,winner:false,lose:false};
const fmt=v=>Number.isInteger(v)?String(v):v.toFixed(1);
const kind=v=>String(v).endsWith('.1')?'yellow':String(v).endsWith('.5')?'red':'number';
const makeDeck=()=>{const d=[];for(let n=1;n<=12;n++)for(let i=0;i<4;i++)d.push(n);const ys=[...Array(11)].map((_,i)=>i+1+0.1);const rs=[...Array(11)].map((_,i)=>i+1+0.5);shuffle(ys);shuffle(rs);for(let i=0;i<S.yellowCount;i++)d.push(ys[i]);for(let i=0;i<S.redCount;i++)d.push(rs[i]);shuffle(d);return d;};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}};
const deal=()=>{S.deck=makeDeck();S.stands=[[],[],[],[]];S.deck.forEach((v,i)=>S.stands[i%4].push({id:crypto.randomUUID(),value:v,faceUp:false,openedByMatch:false,told:false}));S.stands.forEach(st=>st.sort((a,b)=>a.value-b.value));};
const allOppIndexes=p=>p===0?[2,3]:[0,1]; const selfIndexes=p=>p===0?[0,1]:[2,3];
const isOpp=(si,p)=>allOppIndexes(p).includes(si);
const hiddenNonRed=()=>S.stands.flat().filter(c=>!c.faceUp&&kind(c.value)!=='red').length;
const hiddenTotal=()=>S.stands.flat().filter(c=>!c.faceUp).length;
function canBulk(card,si,ci){if(kind(card.value)==='red')return false;const [a,b]=selfIndexes(S.current);const self=[...S.stands[a],...S.stands[b]].filter(c=>!c.faceUp);
const val=kind(card.value)==='yellow'?'yellow':card.value;const same=self.filter(c=>(kind(c.value)==='yellow'&&val==='yellow')||c.value===val);
if(same.length>=4)return true;if(hiddenTotal()===self.length&&self.length>0){if(val==='yellow') return self.length===2 && same.length===2;return same.length===self.length;}
return false;}
function checkWinLose(){if(S.miss>=2){S.lose=true;S.overlay={type:'end',text:'敗北…'};return;}if(hiddenNonRed()===0||hiddenTotal()===0){S.winner=true;S.overlay={type:'win'};setTimeout(()=>render(),1600);} }
function nextTurn(){S.current=1-S.current;S.turn++;S.action='normal';S.selectedSelf=null;S.selectedOpp=[];S.overlay={type:'swap'};}
function normalJudge(selfCard,oppCard){let ok=false,go=false;if(kind(selfCard.value)==='yellow'){ok=kind(oppCard.value)==='yellow';}else{if(kind(oppCard.value)==='red')go=true;else ok=oppCard.value===selfCard.value;}
if(go){S.lose=true;S.overlay={type:'end',text:'赤カードに通常宣言！即敗北'};return;}if(ok){oppCard.faceUp=true;oppCard.openedByMatch=true;}else S.miss++;S.result={ok,detail:`宣言:${fmt(selfCard.value)} / 相手:${fmt(oppCard.value)} / ミス:${S.miss}`};S.overlay={type:'result'};checkWinLose();}
function abilityJudge(selfCard,oppCards){const hits=oppCards.filter(c=>c.value===selfCard.value);if(hits.length===0){S.miss++;S.result={ok:false,detail:`能力失敗 / ミス:${S.miss}`};}
else{const target=hits[0];target.faceUp=true;target.openedByMatch=true;S.result={ok:true,detail:`能力成功: ${fmt(target.value)} をオープン`};}
S.overlay={type:'result'};S.abilityUsed[S.current]=true;checkWinLose();}
function renderCard(c,{hidden,hint=false,told=false,oppOpen=false,selfOpen=false,onClick,label}={}){return `<div class="card ${hidden?'back':'front '+kind(c.value)} ${oppOpen?'open-opponent':''} ${selfOpen?'open-self':''}" data-id="${c.id}">${!hidden?fmt(c.value):''}${hint?`<span class="badge hint">HINT</span><span class="label">${label}</span>`:''}${told?'<span class="badge">伝</span>':''}</div>`;}
function mountHandlers(){document.querySelectorAll('[data-action]').forEach(b=>b.onclick=actions[b.dataset.action]);document.querySelectorAll('.card').forEach(el=>el.onclick=()=>onCard(el.dataset.id));}
function onCard(id){const hit=S.stands.flatMap((st,si)=>st.map((c,ci)=>({c,si,ci}))).find(x=>x.c.id===id);if(!hit)return;
if(S.phase==='hint'){if(selfIndexes(S.hintPhase).includes(hit.si)&&kind(hit.c.value)==='number'){S.hints[S.hintPhase]={stand:hit.si%2+1,value:hit.c.value,id:hit.c.id};hit.c.told=true;S.overlay={type:'swapHint'};if(S.hintPhase===1){S.phase='ready';S.overlay={type:'confirmHints'};}else S.hintPhase=1;render();}return;}
if(S.phase!=='play')return;
const my=selfIndexes(S.current),opp=allOppIndexes(S.current);
if(S.action==='bulk'){if(my.includes(hit.si)&&canBulk(hit.c,hit.si,hit.ci)){const key=kind(hit.c.value)==='yellow'?'yellow':hit.c.value;my.forEach(i=>S.stands[i].forEach(c=>{if(!c.faceUp&&((key==='yellow'&&kind(c.value)==='yellow')||c.value===key)){c.faceUp=true;c.openedByMatch=true;}}));S.result={ok:true,detail:`一括オープン: ${fmt(hit.c.value)}`};S.overlay={type:'result'};checkWinLose();render();}return;}
if(S.action==='normal'){if(my.includes(hit.si))S.selectedSelf=hit.c; if(opp.includes(hit.si)&&!hit.c.faceUp)S.selectedOpp=[hit.c]; if(S.selectedSelf&&S.selectedOpp.length===1){normalJudge(S.selectedSelf,S.selectedOpp[0]);} render();return;}
if(S.action==='ability'){if(my.includes(hit.si))S.selectedSelf=hit.c; if(opp.includes(hit.si)&&!hit.c.faceUp){if(!S.selectedOpp.find(x=>x.id===hit.c.id)&&S.selectedOpp.length<2)S.selectedOpp.push(hit.c);} if(S.selectedSelf&&S.selectedOpp.length===2){abilityJudge(S.selectedSelf,S.selectedOpp);} render();}
}
const actions={start(){deal();S.phase='hint';render();},toPlay(){S.phase='play';S.overlay={type:'swap'};render();},closeOverlay(){S.overlay=null;if(S.lose||S.winner)return; if(S.phase==='play'&&S.result){S.result=null;nextTurn();} render();},setNormal(){S.action='normal';S.selectedSelf=null;S.selectedOpp=[];render();},setBulk(){S.action='bulk';S.selectedSelf=null;S.selectedOpp=[];render();},setAbility(){S.action='ability';S.selectedSelf=null;S.selectedOpp=[];render();}};
function view(){if(S.phase==='setup')return `<div class="panel"><h2>初期設定</h2><div class="row">黄色:<button data-action="y0" class="secondary">0</button><button data-action="y2" class="secondary">2</button><button data-action="y4" class="secondary">4</button> 赤:${[1,2,3,4].map(n=>`<button data-r="${n}" class="secondary">${n}</button>`).join(' ')}</div><p>合計枚数: ${48+S.yellowCount+S.redCount}</p><button data-action="start">ゲーム開始前ヒントへ</button></div>`;
const oppIdx=allOppIndexes(S.current),myIdx=selfIndexes(S.current);const hintFromOpp=S.hints[1-S.current];
return `<div class="panel row"><b>特殊カード</b> 黄:[${S.deck.filter(v=>kind(v)==='yellow').map(fmt).join(',')||'-'}] 赤:[${S.deck.filter(v=>kind(v)==='red').map(fmt).join(',')}]</div>
<div class="panel">相手ヒント: ${hintFromOpp?`スタンド${hintFromOpp.stand}の『${hintFromOpp.value}』`:'(未設定)'}</div>
<div class="panel row">ターン:P${S.current+1} / ミス:${'<span class="dot on"></span>'.repeat(S.miss)+'<span class="dot"></span>'.repeat(2-S.miss)} / 能力:${S.abilityUsed[S.current]?'使用済':'残1回'} / アクション:${S.action}</div>
<div class="dual">${oppIdx.map((si,k)=>`<div class="panel"><h3>相手スタンド${k+1}</h3><div class="grid">${S.stands[si].map(c=>renderCard(c,{hidden:!c.faceUp,hint:S.hints[1-S.current]?.id===c.id&&!c.faceUp,label:S.hints[1-S.current]?.value,oppOpen:c.faceUp&&c.openedByMatch})).join('')}</div></div>`).join('')}</div>
<div class="dual">${myIdx.map((si,k)=>`<div class="panel"><h3>自分スタンド${k+1}</h3><div class="grid">${S.stands[si].map(c=>renderCard(c,{hidden:false,told:c.told,selfOpen:c.faceUp})).join('')}</div></div>`).join('')}</div>
<div class="panel row"><button data-action="setNormal">通常宣言</button><button data-action="setBulk">一括オープン</button><button data-action="setAbility" ${S.abilityUsed[S.current]?'disabled':''}>特殊能力</button><span class="small">選択: 自:${S.selectedSelf?fmt(S.selectedSelf.value):'-'} 相:${S.selectedOpp.map(c=>fmt(c.value)).join('/')||'-'}</span></div>`;
}
function render(){app.innerHTML=view(); if(S.phase==='setup'){document.querySelector('[data-action=y0]').onclick=()=>{S.yellowCount=0;render()};document.querySelector('[data-action=y2]').onclick=()=>{S.yellowCount=2;render()};document.querySelector('[data-action=y4]').onclick=()=>{S.yellowCount=4;render()};document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{S.redCount=Number(b.dataset.r);render();});}
mountHandlers(); if(S.overlay){const o=document.createElement('div');o.className='overlay';if(S.overlay.type==='swap')o.innerHTML='<div class="modal"><div class="big">プレイヤー交代</div><p class="small">タップで次へ</p><button data-action="closeOverlay">OK</button></div>';
if(S.overlay.type==='swapHint')o.innerHTML='<div class="modal"><div class="big">プレイヤー交代</div><p>P1/P2 のヒント入力を交代します</p><button data-action="closeOverlay">OK</button></div>';
if(S.overlay.type==='confirmHints')o.innerHTML=`<div class="modal"><h3>ヒント確認</h3><p>P1→P2: スタンド${S.hints[0].stand}の『${S.hints[0].value}』</p><p>P2→P1: スタンド${S.hints[1].stand}の『${S.hints[1].value}』</p><button data-action="toPlay">ゲーム開始！</button></div>`;
if(S.overlay.type==='result')o.innerHTML=`<div class="modal"><div class="big ${S.result.ok?'ok':'ng'}">${S.result.ok?'正解！':'不正解'}</div><p>${S.result.detail}</p><button data-action="closeOverlay">次へ</button></div>`;
if(S.overlay.type==='end')o.innerHTML=`<div class="modal"><div class="big ng">${S.overlay.text}</div><button onclick="location.reload()">リトライ</button></div>`;
if(S.overlay.type==='win')o.innerHTML=`<div class="confetti">${Array.from({length:120}).map((_,i)=>`<span style="position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;width:6px;height:10px;background:hsl(${Math.random()*360},90%,60%);display:block;transform:rotate(${Math.random()*360}deg)"></span>`).join('')}</div><div class="modal"><div class="big ok">勝利！</div><p>全ての非赤カードをオープンしました。</p><button onclick="location.reload()">もう一度</button></div>`;
 document.body.appendChild(o);o.querySelectorAll('[data-action]').forEach(b=>b.onclick=actions[b.dataset.action]);}
}
render();
