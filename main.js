const app = document.getElementById('app');

const S = {
  phase: 'start', // start | setup | hint | ready | play
  yellowCount: 2,
  redCount: 1,
  playerNames: ['プレイヤー1', 'プレイヤー2'],
  deck: [],
  stands: [[], [], [], []],
  current: 0,
  turn: 1,
  miss: 0,
  hints: [null, null],
  hintPhase: 0,
  action: 'normal',
  selectedSelf: null,
  selectedOpp: [],
  abilityUsed: [false, false],
  overlay: null,
  result: null,
  winner: false,
  lose: false,
  pendingAbilityMiss: null,
};

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const kind = (v) => String(v).endsWith('.1') ? 'yellow' : String(v).endsWith('.5') ? 'red' : 'number';
const selfIndexes = (p) => p === 0 ? [0, 1] : [2, 3];
const allOppIndexes = (p) => p === 0 ? [2, 3] : [0, 1];

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

function makeDeck() {
  const d = [];
  for (let n = 1; n <= 12; n++) for (let i = 0; i < 4; i++) d.push(n);
  const ys = [...Array(11)].map((_, i) => i + 1 + 0.1);
  const rs = [...Array(11)].map((_, i) => i + 1 + 0.5);
  shuffle(ys); shuffle(rs);
  for (let i = 0; i < S.yellowCount; i++) d.push(ys[i]);
  for (let i = 0; i < S.redCount; i++) d.push(rs[i]);
  shuffle(d);
  return d;
}

function deal() {
  S.deck = makeDeck();
  S.stands = [[], [], [], []];
  S.deck.forEach((v, i) => S.stands[i % 4].push({ id: crypto.randomUUID(), value: v, faceUp: false, openedByMatch: false, told: false }));
  S.stands.forEach((st) => st.sort((a, b) => a.value - b.value));
}

const hiddenNonRed = () => S.stands.flat().filter((c) => !c.faceUp && kind(c.value) !== 'red').length;
const hiddenTotal = () => S.stands.flat().filter((c) => !c.faceUp).length;

function canBulk(card) {
  if (kind(card.value) === 'red') return false;
  const [a, b] = selfIndexes(S.current);
  const self = [...S.stands[a], ...S.stands[b]].filter((c) => !c.faceUp);
  const val = kind(card.value) === 'yellow' ? 'yellow' : card.value;
  const same = self.filter((c) => (val === 'yellow' ? kind(c.value) === 'yellow' : c.value === val));
  if (same.length >= 4) return true;
  if (hiddenTotal() === self.length && self.length > 0) {
    if (val === 'yellow') return self.length === 2 && same.length === 2;
    return same.length === self.length;
  }
  return false;
}

function checkWinLose() {
  if (S.miss >= 2) { S.lose = true; S.overlay = { type: 'end', text: 'ミスが2回になりました。敗北…' }; return; }
  if (hiddenNonRed() === 0 || hiddenTotal() === 0) { S.winner = true; S.overlay = { type: 'win' }; setTimeout(render, 1600); }
}

function nextTurn() {
  S.current = 1 - S.current;
  S.turn += 1;
  S.action = 'normal';
  S.selectedSelf = null;
  S.selectedOpp = [];
  S.overlay = { type: 'swap', nextPlayer: S.current, message: `${S.playerNames[S.current]}さんの番です。通常宣言・一括オープン・特殊能力から選んでください。` };
}

function normalJudge(selfCard, oppCard) {
  let ok = false, gameOver = false;
  if (kind(selfCard.value) === 'yellow') ok = kind(oppCard.value) === 'yellow';
  else if (kind(oppCard.value) === 'red') gameOver = true;
  else ok = selfCard.value === oppCard.value;

  if (gameOver) { S.lose = true; S.overlay = { type: 'end', text: '赤カードに通常宣言しました。即敗北です。' }; return; }
  if (ok) { oppCard.faceUp = true; oppCard.openedByMatch = true; } else { S.miss += 1; markMissHint(oppCard);} 
  S.result = { ok, detail: `宣言: ${fmt(selfCard.value)} / 相手: ${fmt(oppCard.value)} / ミス: ${S.miss}` };
  S.overlay = { type: 'result' };
  checkWinLose();
}

function abilityJudge(selfCard, oppCards) {
  const hits = oppCards.filter((c) => c.value === selfCard.value);
  if (hits.length === 0) {
    S.miss += 1;
    const nonRed = oppCards.filter((c)=>kind(c.value)!=='red');
    if (nonRed.length === 1) markMissHint(nonRed[0]);
    else if (nonRed.length === 2) {
      S.pendingAbilityMiss = oppCards;
      S.overlay = { type: 'abilityMissChoice' };
      return;
    }
    S.result = { ok: false, detail: `能力失敗 / ミス: ${S.miss}` };
  } else {
    hits[0].faceUp = true; hits[0].openedByMatch = true;
    S.result = { ok: true, detail: `能力成功: ${fmt(hits[0].value)} をオープン` };
  }
  S.abilityUsed[S.current] = true;
  S.overlay = { type: 'result' };
  checkWinLose();
}

function renderCard(c, { hidden, hint = false, told = false, oppOpen = false, selfOpen = false, selectable = false, selected=false, label = '' } = {}) {
  const showHint = hint || (!!c.revealedHint && hidden);
  const hintLabel = label || c.revealedHint || '';
  return `<div class="card ${hidden ? 'back' : 'front ' + kind(c.value)} ${oppOpen ? 'open-opponent' : ''} ${selfOpen ? 'open-self' : ''} ${selectable ? 'selectable' : ''} ${selected ? 'selected-card' : ''} ${c.faceUp ? 'lifted' : ''}" data-id="${c.id}">${hidden ? '' : fmt(c.value)}${showHint ? `<span class="badge hint">HINT</span><span class="label">${hintLabel}</span>` : ''}${told ? '<span class="badge">伝</span>' : ''}</div>`;
}


function markMissHint(card){
  if (kind(card.value)==='yellow') card.revealedHint='黄';
  else if (kind(card.value)==='number') card.revealedHint=String(card.value);
}

function onCard(id) {
  const hit = S.stands.flatMap((st, si) => st.map((c, ci) => ({ c, si, ci }))).find((x) => x.c.id === id);
  if (!hit) return;

  if (S.phase === 'hint') {
    if (selfIndexes(S.hintPhase).includes(hit.si) && kind(hit.c.value) === 'number') {
      S.hints[S.hintPhase] = { stand: (hit.si % 2) + 1, value: hit.c.value, id: hit.c.id };
      hit.c.told = true;
      if (S.hintPhase === 0) {
        S.hintPhase = 1;
        S.overlay = { type: 'swap', nextPlayer: 1, message: `${S.playerNames[1]}さん、あなたのスタンドから数字カード1枚を選び、相手に伝えてください。` };
      } else {
        S.phase = 'ready';
        S.overlay = { type: 'confirmHints' };
      }
      render();
    }
    return;
  }

  if (S.phase !== 'play') return;
  const my = selfIndexes(S.current), opp = allOppIndexes(S.current);

  if (S.action === 'bulk') {
    if (my.includes(hit.si) && canBulk(hit.c)) {
      const key = kind(hit.c.value) === 'yellow' ? 'yellow' : hit.c.value;
      my.forEach((i) => S.stands[i].forEach((c) => {
        if (!c.faceUp && ((key === 'yellow' && kind(c.value) === 'yellow') || c.value === key)) { c.faceUp = true; c.openedByMatch = true; }
      }));
      S.result = { ok: true, detail: `一括オープン: ${fmt(hit.c.value)}` };
      S.overlay = { type: 'result' }; checkWinLose(); render();
    }
    return;
  }

  if (S.action === 'normal') {
    if (my.includes(hit.si)) S.selectedSelf = hit.c;
    if (opp.includes(hit.si) && !hit.c.faceUp) S.selectedOpp = [hit.c];
    if (S.selectedSelf && S.selectedOpp.length === 1) normalJudge(S.selectedSelf, S.selectedOpp[0]);
    render(); return;
  }

  if (S.action === 'ability') {
    if (my.includes(hit.si)) S.selectedSelf = hit.c;
    if (opp.includes(hit.si) && !hit.c.faceUp && !S.selectedOpp.find((x) => x.id === hit.c.id) && S.selectedOpp.length < 2) S.selectedOpp.push(hit.c);
    if (S.selectedSelf && S.selectedOpp.length === 2) abilityJudge(S.selectedSelf, S.selectedOpp);
    render();
  }
}

const actions = {
  goSetup() { S.phase = 'setup'; render(); },
  start() {
    const n1 = document.querySelector('#p1')?.value?.trim();
    const n2 = document.querySelector('#p2')?.value?.trim();
    S.playerNames = [n1 || 'プレイヤー1', n2 || 'プレイヤー2'];
    deal();
    S.phase = 'hint';
    S.overlay = { type: 'swap', nextPlayer: 0, message: `${S.playerNames[0]}さん、あなたのスタンドから数字カード1枚を選び、相手に伝えてください。` };
    render();
  },
  toPlay() { S.phase = 'play'; S.current = 0; S.overlay = { type: 'swap', nextPlayer: 0, message: `${S.playerNames[0]}さん、ゲーム開始です。行動を選択してください。` }; render(); },
  closeOverlay() {
    S.overlay = null;
    if (S.lose || S.winner) return;
    if (S.phase === 'play' && S.result) { S.result = null; nextTurn(); }
    render();
  },
  setNormal() { S.action = 'normal'; S.selectedSelf = null; S.selectedOpp = []; render(); },
  setBulk() { S.action = 'bulk'; S.selectedSelf = null; S.selectedOpp = []; render(); },
  setAbility() { S.action = 'ability'; S.selectedSelf = null; S.selectedOpp = []; render(); },
  setYellow(v) { S.yellowCount = v; render(); },
  setRed(v) { S.redCount = v; render(); },
  abilityMiss0(){ if(S.pendingAbilityMiss?.[0]) markMissHint(S.pendingAbilityMiss[0]); S.pendingAbilityMiss=null; S.abilityUsed[S.current]=true; S.result={ok:false,detail:`能力失敗 / ミス: ${S.miss}`}; S.overlay={type:'result'}; checkWinLose(); render();},
  abilityMiss1(){ if(S.pendingAbilityMiss?.[1]) markMissHint(S.pendingAbilityMiss[1]); S.pendingAbilityMiss=null; S.abilityUsed[S.current]=true; S.result={ok:false,detail:`能力失敗 / ミス: ${S.miss}`}; S.overlay={type:'result'}; checkWinLose(); render();},
};

function view() {
  if (S.phase === 'start') {
    return `<div class="start-screen">
      <div class="logo">
        <div class="logo-main">2人協力パズル</div>
        <div class="logo-sub">PUZZLE STYLE</div>
      </div>
      <button class="start-btn" data-action="goSetup">スタート</button>
    </div>`;
  }

  if (S.phase === 'setup') {
    return `<div class="panel"><h2>初期設定</h2>
      <div class="row"><label>プレイヤー1名 <input id="p1" value="${S.playerNames[0]}" data-name="0" /></label><label>プレイヤー2名 <input id="p2" value="${S.playerNames[1]}" data-name="1" /></label></div>
      <div class="row">黄色:${[0,2,4].map((n)=>`<button data-yellow="${n}" class="secondary ${S.yellowCount===n?'selected':''}">${n}</button>`).join('')} 赤:${[0,1,2,3,4].map((n)=>`<button data-red="${n}" class="secondary ${S.redCount===n?'selected':''}">${n}</button>`).join('')}</div>
      <p>合計枚数: ${48 + S.yellowCount + S.redCount}</p><button data-action="start">ヒント開始へ</button></div>`;
  }

  const hintPlayer = S.hintPhase;
  const viewPlayer = S.phase==='hint' ? hintPlayer : S.current;
  const oppIdx = allOppIndexes(viewPlayer), myIdx = selfIndexes(viewPlayer);
  const hintFromOpp = S.hints[1 - viewPlayer];
  const currentName = S.playerNames[S.current];

  const yList = S.deck.filter((v)=>kind(v)==='yellow').sort((a,b)=>a-b).map(fmt);
  const rList = S.deck.filter((v)=>kind(v)==='red').sort((a,b)=>a-b).map(fmt);

  return `<div class="panel special-bar"><b>特殊カード</b><span class="chip yellow-chip">黄 ${yList.join(' / ') || '-'}</span><span class="chip red-chip">赤 ${rList.join(' / ') || '-'}</span></div>
    <div class="panel">相手ヒント: ${hintFromOpp ? `スタンド${hintFromOpp.stand}の『${hintFromOpp.value}』` : '(未設定)'}</div>
    <div class="panel row">現在: ${currentName} / ターン: ${S.turn} / ミス:${'<span class="dot on"></span>'.repeat(S.miss)}${'<span class="dot"></span>'.repeat(2 - S.miss)} / 能力:${S.abilityUsed[S.current] ? '使用済' : '残1回'} / アクション:${S.action}</div>
    <div class="panel"><h3>"${S.playerNames[oppIdx[0] < 2 ? 0 : 1]}"さんのスタンド①</h3><div class="line">${S.stands[oppIdx[0]].map((c)=>renderCard(c,{hidden:S.phase==='hint'?true:!c.faceUp,hint:S.hints[1-viewPlayer]?.id===c.id,label:S.hints[1-viewPlayer]?.value,oppOpen:c.faceUp&&c.openedByMatch,selected:S.selectedOpp.some(x=>x.id===c.id)})).join('')}</div></div>
    <div class="panel"><h3>"${S.playerNames[oppIdx[1] < 2 ? 0 : 1]}"さんのスタンド②</h3><div class="line">${S.stands[oppIdx[1]].map((c)=>renderCard(c,{hidden:S.phase==='hint'?true:!c.faceUp,hint:S.hints[1-viewPlayer]?.id===c.id,label:S.hints[1-viewPlayer]?.value,oppOpen:c.faceUp&&c.openedByMatch,selected:S.selectedOpp.some(x=>x.id===c.id)})).join('')}</div></div>
    <div class="panel"><h3>"${S.playerNames[myIdx[0] < 2 ? 0 : 1]}"さんのスタンド①</h3><div class="line">${S.stands[myIdx[0]].map((c)=>renderCard(c,{hidden:false,told:c.told,selfOpen:c.faceUp,selectable:S.action==='bulk'&&canBulk(c),selected:S.selectedSelf?.id===c.id})).join('')}</div></div>
    <div class="panel"><h3>"${S.playerNames[myIdx[1] < 2 ? 0 : 1]}"さんのスタンド②</h3><div class="line">${S.stands[myIdx[1]].map((c)=>renderCard(c,{hidden:false,told:c.told,selfOpen:c.faceUp,selectable:S.action==='bulk'&&canBulk(c),selected:S.selectedSelf?.id===c.id})).join('')}</div></div>
    <div class="panel row"><button class="action-btn ${S.action==='normal'?'active':''}" data-action="setNormal">通常宣言</button><button class="action-btn ${S.action==='bulk'?'active':''}" data-action="setBulk">一括オープン</button><button class="action-btn ${S.action==='ability'?'active':''}" data-action="setAbility" ${S.abilityUsed[S.current] ? 'disabled' : ''}>特殊能力</button><span class="small">選択: 自:${S.selectedSelf ? fmt(S.selectedSelf.value) : '-'} 相:${S.selectedOpp.map((c)=>fmt(c.value)).join('/') || '-'} / ${S.action==='bulk'?'自分スタンドの開きたいカードを1枚選択':''}</span></div>`;
}

function render() {
  app.innerHTML = view();
  document.querySelectorAll('[data-action]').forEach((b) => b.onclick = () => actions[b.dataset.action]());
  document.querySelectorAll('[data-yellow]').forEach((b) => b.onclick = () => actions.setYellow(Number(b.dataset.yellow)));
  document.querySelectorAll('[data-red]').forEach((b) => b.onclick = () => actions.setRed(Number(b.dataset.red)));
  document.querySelectorAll('[data-name]').forEach((inp) => inp.oninput = (e) => {
    const idx = Number(e.target.dataset.name);
    S.playerNames[idx] = e.target.value;
  });
  document.querySelectorAll('.card').forEach((el) => el.onclick = () => onCard(el.dataset.id));

  const existing = document.querySelector('.overlay');
  if (existing) existing.remove();

  if (S.overlay) {
    const o = document.createElement('div');
    o.className = 'overlay' + (S.overlay.type === 'swap' ? ' blackout' : '');
    if (S.overlay.type === 'swap') o.innerHTML = `<div class="modal"><div class="big">プレイヤー交代</div><p><b>"${S.playerNames[S.overlay.nextPlayer]}さん"のターンです。</b></p><p>${S.overlay.message}</p><button data-action="closeOverlay">OK</button></div>`;
    if (S.overlay.type === 'abilityMissChoice') o.innerHTML = `<div class="modal"><h3>能力失敗：公開ヒントを選択</h3><p>どちらのカード情報を公開しますか？</p><div class="row"><button data-action="abilityMiss0">${S.pendingAbilityMiss?.[0]? (kind(S.pendingAbilityMiss[0].value)==='yellow'?'黄候補':'数字候補') : ''}</button><button data-action="abilityMiss1">${S.pendingAbilityMiss?.[1]? (kind(S.pendingAbilityMiss[1].value)==='yellow'?'黄候補':'数字候補') : ''}</button></div></div>`;
    if (S.overlay.type === 'confirmHints') o.innerHTML = `<div class="modal"><h3>ヒント確認</h3><p>${S.playerNames[0]}→${S.playerNames[1]}: スタンド${S.hints[0].stand}の『${S.hints[0].value}』</p><p>${S.playerNames[1]}→${S.playerNames[0]}: スタンド${S.hints[1].stand}の『${S.hints[1].value}』</p><button data-action="toPlay">ゲーム開始！</button></div>`;
    if (S.overlay.type === 'result') o.innerHTML = `<div class="modal"><div class="big ${S.result.ok ? 'ok' : 'ng'}">${S.result.ok ? '正解！' : '不正解'}</div><p>${S.result.detail}</p><button data-action="closeOverlay">次へ</button></div>`;
    if (S.overlay.type === 'end') o.innerHTML = `<div class="modal"><div class="big ng">${S.overlay.text}</div><button onclick="location.reload()">リトライ</button></div>`;
    if (S.overlay.type === 'win') o.innerHTML = `<div class="confetti">${Array.from({length:100}).map(()=>`<span style="position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;width:6px;height:10px;background:hsl(${Math.random()*360},90%,60%);display:block;"></span>`).join('')}</div><div class="modal"><div class="big ok">勝利！</div><p>全ての非赤カードをオープンしました。</p><button onclick="location.reload()">もう一度</button></div>`;
    document.body.appendChild(o);
    o.querySelectorAll('[data-action]').forEach((b) => b.onclick = () => actions[b.dataset.action]());
  }
}

render();
