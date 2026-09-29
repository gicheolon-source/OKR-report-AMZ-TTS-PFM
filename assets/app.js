/* Dr.Rejuall OKR 보고 사이트 — 정적 SPA (GitHub Pages)
 * - data/index.json  : 보고서 목록 + 파트 구성
 * - data/<id>.json   : 기간별 보고서 (예: 2026-09, 2026-Q3)
 * - 편집 모드 수정 내용은 localStorage("okr:<id>")에 저장. JSON 내보내기/불러오기로 공유.
 */
(() => {
  'use strict';

  const STORE = 'okr:';
  const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Done', 'Hold', 'Exceeded'];
  const TAB_INTERVIEWS = 'interviews';

  const state = {
    index: null,
    period: null,
    periodId: null,
    tab: null,
    edit: false,
    unlocked: false,
    fromLocal: false,
    saveTimer: null,
  };

  // ---------- utils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[l] = v; };
  const parentOf = (p) => { const ks = p.split('.'); const k = ks.pop(); return [ks.join('.'), +k]; };
  const deep = (o) => JSON.parse(JSON.stringify(o));

  function periodMeta(id) {
    const m = String(id || '').match(/^(\d{4})-(?:Q([1-4])|(\d{2}))$/);
    if (!m) return null;
    const y = +m[1];
    if (m[2]) return { type: 'quarter', year: y, n: +m[2], label: `${y}년 ${m[2]}분기`, title: `${m[2]}분기 OKR 분기 결산` };
    const mo = +m[3];
    if (mo < 1 || mo > 12) return null;
    return { type: 'month', year: y, n: mo, label: `${y}년 ${mo}월`, title: `${mo}월 OKR 월간 결산` };
  }
  function currentMonthId() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function statusClass(s) {
    const t = String(s || '').toLowerCase();
    if (/exceed|초과/.test(t)) return 'ok';
    if (/done|완료|사용중/.test(t)) return 'ok';
    if (/progress|진행|상시/.test(t)) return 'run';
    if (/hold|보류|기간종료|지연/.test(t)) return 'hold';
    if (/프로모션/.test(t)) return 'dark';
    if (/1순위/.test(t)) return 'pri1';
    if (/2순위/.test(t)) return 'pri2';
    if (/3순위/.test(t)) return 'pri3';
    return 'na';
  }
  const STATUS_KO = { 'In Progress': '진행중', 'Done': '완료', 'Hold': '보류', 'Not Started': '미착수', 'Exceeded': '초과 달성' };
  function badge(s) {
    if (!s) return '<span class="dash">—</span>';
    const ko = STATUS_KO[s];
    return `<span class="badge ${statusClass(s)}">${esc(s)}${ko ? ` · ${ko}` : ''}</span>`;
  }

  // SHA-256 (WebCrypto 우선, 비보안 컨텍스트 대비 JS 폴백)
  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    if (globalThis.crypto?.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (_) { /* fall through */ }
    }
    return sha256Fallback(bytes);
  }
  function sha256Fallback(bytes) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length;
    const padLen = (((l + 9) + 63) >> 6) << 6;
    const buf = new Uint8Array(padLen); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(padLen - 4, (l * 8) >>> 0); dv.setUint32(padLen - 8, Math.floor((l * 8) / 4294967296));
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < padLen; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      const R = [a, b, c, d, e, f, g, h];
      H = H.map((v, i) => (v + R[i]) >>> 0);
    }
    return H.map((v) => v.toString(16).padStart(8, '0')).join('');
  }

  // ---------- data loading ----------
  async function fetchJson(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${path} 로드 실패 (${r.status})`);
    return r.json();
  }
  function materialize(tpl, id) {
    const m = periodMeta(id);
    const s = JSON.stringify(tpl).replaceAll('__ID__', id).replaceAll('__LABEL__', m.label).replaceAll('__TITLE__', m.title);
    const p = JSON.parse(s);
    p.id = id; p.type = m.type; p.label = m.label; p.title = p.title || m.title;
    return p;
  }
  async function loadPeriod(id) {
    const local = localStorage.getItem(STORE + id);
    if (local) {
      try { state.fromLocal = true; return JSON.parse(local); } catch (_) { localStorage.removeItem(STORE + id); }
    }
    state.fromLocal = false;
    const entry = state.index.periods.find((p) => p.id === id);
    if (entry) return fetchJson('data/' + entry.file);
    const m = periodMeta(id);
    const tpl = await fetchJson(m.type === 'quarter' ? 'data/template-quarter.json' : 'data/template-month.json');
    return materialize(tpl, id);
  }

  function save() {
    if (!state.period || !state.periodId) return;
    localStorage.setItem(STORE + state.periodId, JSON.stringify(state.period));
    state.fromLocal = true;
    const el = $('#save-state');
    if (el) { el.className = 'save-state local'; el.textContent = `● 브라우저에 저장됨 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`; }
  }
  function scheduleSave() { clearTimeout(state.saveTimer); state.saveTimer = setTimeout(save, 300); }

  // ---------- routing ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [pid, tab] = h.split('/').filter(Boolean);
    return { pid: pid || null, tab: tab || null };
  }
  function go(pid, tab) { location.hash = tab ? `#/${pid}/${tab}` : `#/${pid}`; }

  async function onRoute() {
    const { pid, tab } = route();
    const app = $('#app');
    try {
      if (!state.index) state.index = await fetchJson('data/index.json');
      if (!pid) { state.period = null; state.periodId = null; state.tab = null; renderHome(); return; }
      if (!periodMeta(pid)) { app.innerHTML = `<div class="error">잘못된 주소입니다: ${esc(pid)}</div>`; return; }
      if (state.periodId !== pid) {
        state.period = await loadPeriod(pid);
        state.periodId = pid;
        state.edit = false;
      }
      const teamIds = state.period.teams.map((t) => t.id);
      const nextTab = tab && (teamIds.includes(tab) || tab === TAB_INTERVIEWS) ? tab : teamIds[0];
      if (nextTab !== state.tab) state.unlocked = false; // 면담시트는 들어갈 때마다 비밀번호
      state.tab = nextTab;
      renderPeriod();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="error"><b>데이터를 불러오지 못했습니다.</b><br>${esc(e.message)}<br><br>로컬에서 열었다면 파일을 직접 여는 대신 간단한 웹서버로 실행해 주세요 (예: <code>npx serve .</code>). GitHub Pages에서는 바로 동작합니다.</div>`;
    }
  }

  // ---------- render: home ----------
  function renderHome() {
    const idx = state.index;
    const year = idx.year || new Date().getFullYear();
    const files = new Set(idx.periods.map((p) => p.id));
    const cur = currentMonthId();
    const card = (id, big) => {
      const m = periodMeta(id);
      const has = files.has(id);
      const local = !!localStorage.getItem(STORE + id);
      return `<a class="pcard ${has ? 'has' : ''} ${id === cur ? 'cur' : ''}" href="#/${id}">
        <div class="pcard-n">${big}</div><div class="pcard-l">${esc(m.label)}</div>
        <div class="pcard-s">${has ? '보고서 보기' : '템플릿으로 시작'}${local ? ' · 수정본 있음' : ''}</div></a>`;
    };
    const quarters = [1, 2, 3, 4].map((q) => card(`${year}-Q${q}`, `Q${q}`)).join('');
    const months = Array.from({ length: 12 }, (_, i) => card(`${year}-${String(i + 1).padStart(2, '0')}`, `${i + 1}월`)).join('');
    const teams = (idx.teams || []).map((t) => `<div class="tcard" style="--team:${t.color}"><h3>${esc(t.name)}</h3><ul>${t.members.map((m) => `<li><b>${esc(m.name)}</b><span>${esc(m.scope || m.role || '')}</span></li>`).join('')}</ul></div>`).join('');

    $('#brand-right').innerHTML = '';
    $('#app').innerHTML = `<div class="home">
      <div class="hero"><div><h1>OKR 보고서</h1><p>아마존 · 틱톡샵 · 퍼포먼스 마케팅 파트의 월간 결산과 분기 결산을 한곳에서. 카드를 눌러 보고서를 열고, <b>편집</b> 버튼으로 페이지 안에서 바로 수정하세요.</p></div><div class="year">${year}</div></div>
      <h2>분기 결산</h2><div class="pgrid q">${quarters}</div>
      <h2>월간 결산</h2><div class="pgrid m">${months}</div>
      ${teams ? `<h2>파트 구성</h2><div class="teams-home">${teams}</div>` : ''}
    </div>`;
  }

  // ---------- render: period ----------
  function bind(path, kind = 'text', ph = '') {
    return state.edit ? `contenteditable="true" data-bind="${path}" data-kind="${kind}" data-ph="${esc(ph)}"` : '';
  }
  function btn(action, path, label, title = '', cls = '', arg = '') {
    return `<button type="button" class="btn ${cls}" data-action="${action}" data-path="${path}" data-arg="${esc(arg)}" title="${esc(title)}">${label}</button>`;
  }
  function statusCell(val, path) {
    if (!state.edit) return badge(val);
    const opts = [...new Set([...STATUS_OPTIONS, val].filter(Boolean))];
    return `<select class="status" data-select="${path}">${opts.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  function linkCell(url, path) {
    if (state.edit) return `<span class="url" ${bind(path, 'text', 'https://…')}>${esc(url)}</span>`;
    return url ? `<a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">링크 ↗</a>` : '<span class="dash">—</span>';
  }

  function renderPeriod() {
    const P = state.period;
    const meta = periodMeta(state.periodId);
    const team = P.teams.find((t) => t.id === state.tab);
    const teamColor = team ? team.color : '#0f766e';
    document.documentElement.style.setProperty('--team', teamColor);

    const tabs = P.teams.map((t) => `<a class="tab ${t.id === state.tab ? 'active' : ''}" href="#/${P.id}/${t.id}" style="--tc:${t.color}"><span class="dot"></span>${esc(t.name)}</a>`).join('')
      + `<a class="tab ${state.tab === TAB_INTERVIEWS ? 'active' : ''}" href="#/${P.id}/${TAB_INTERVIEWS}" style="--tc:#9ca3af">🔒 면담시트</a>`;

    const saveState = state.fromLocal ? `<span id="save-state" class="save-state local">● 브라우저 수정본</span>` : `<span id="save-state" class="save-state">원본 데이터</span>`;

    $('#brand-right').innerHTML = `<a class="btn sm" href="#/">← 전체 보고서</a>`;
    $('#app').innerHTML = `
      ${state.edit ? `<div class="edit-banner"><b>편집 모드</b> — 텍스트를 클릭해 바로 수정하세요. 변경 내용은 이 브라우저에 자동 저장됩니다. 팀과 공유하려면 <b>JSON 내보내기</b> 후 data/${esc(P.id)}.json 파일을 교체해 커밋하세요.</div>` : ''}
      <div class="topbar"><div class="topbar-in">
        <div class="ptitle"><span class="plabel">${esc(P.label || meta.label)}</span><h1 ${bind('title', 'text', '보고서 제목')}>${esc(P.title || meta.title)}</h1><span class="pdate" ${bind('date', 'text', 'YYYY-MM-DD')}>${esc(P.date || '')}</span></div>
        <div class="tools">${saveState}
          ${btn('toggle-edit', '', state.edit ? '✓ 편집 완료' : '✎ 편집', '페이지 내 직접 수정', state.edit ? 'primary' : '')}
          ${btn('export', '', '⤓ JSON 내보내기', '현재 보고서를 JSON 파일로 저장')}
          ${btn('import', '', '⤒ 불러오기', 'JSON 파일 불러오기')}
          ${state.fromLocal ? btn('reset', '', '↺ 원본으로', '브라우저 수정본 삭제', 'danger') : ''}
          ${btn('print', '', '🖨 인쇄', 'PDF 저장/인쇄')}
        </div>
      </div><nav class="tabs">${tabs}</nav></div>
      <div class="layout ${state.edit ? 'edit' : ''}" id="layout"></div>`;

    const layout = $('#layout');
    if (state.tab === TAB_INTERVIEWS) {
      layout.style.gridTemplateColumns = '1fr';
      layout.innerHTML = `<div class="content">${renderInterviews()}</div>`;
      if (!state.unlocked) setTimeout(() => $('#pw')?.focus(), 50);
      return;
    }
    layout.style.gridTemplateColumns = '';
    const ti = P.teams.indexOf(team);
    const { side, main, chips } = renderTeam(team, ti);
    layout.innerHTML = `<aside class="side">${side}</aside><div class="content"><div class="chips">${chips}</div>${main}</div>`;
  }

  function renderTeam(team, ti) {
    const E = state.edit;
    const base = `teams.${ti}`;
    const groups = team.groups || [];
    const secs = team.sections || [];

    const side = `<div class="side-title">${esc(team.name)}</div><a data-scroll="top">개요 · 담당 구성</a>`
      + groups.map((g) => `<a data-scroll="g-${g.id}">${g.flag || ''} ${esc(g.title)}<small>${esc(g.owner || '')}</small></a>`).join('');
    const chips = `<a data-scroll="top">개요</a>` + groups.map((g) => `<a data-scroll="g-${g.id}">${g.flag || ''} ${esc(g.title)}</a>`).join('');

    let main = `<div id="top" class="team-hero"><div class="team-name" ${bind(base + '.name')}>${esc(team.name)}</div><div class="team-cap">담당 구성 · 국가/영역별 담당자</div><div class="members">`
      + (team.members || []).map((m, i) => `<div class="member"><div class="avatar">${esc((m.name || '?')[0])}</div><div>
          <div class="m-name" ${bind(`${base}.members.${i}.name`, 'text', '이름')}>${esc(m.name)}</div>
          <div class="m-role" ${bind(`${base}.members.${i}.role`, 'text', '역할')}>${esc(m.role)}</div>
          <div class="m-scope" ${bind(`${base}.members.${i}.scope`, 'text', '담당 국가/영역')}>${esc(m.scope)}</div></div>
          ${E ? `<span class="del">${btn('del-member', `${base}.members.${i}`, '×', '삭제', 'icon danger')}</span>` : ''}</div>`).join('')
      + (E ? `<div class="member" style="align-items:center;justify-content:center;background:transparent;border-style:dashed">${btn('add-member', `${base}.members`, '+ 담당자 추가', '', 'ghost')}</div>` : '')
      + `</div></div>`;

    // 그룹 없는 섹션(하이라이트 등)
    secs.forEach((s, si) => { if (!s.group) main += renderSection(s, `${base}.sections.${si}`); });
    if (E) main += addSectionBar(base, '');

    const known = new Set(groups.map((g) => g.id));
    groups.forEach((g, gi) => {
      const gp = `${base}.groups.${gi}`;
      main += `<div class="group" id="g-${g.id}"><div class="group-head"><span class="flag" ${bind(gp + '.flag', 'text', '🏳️')}>${esc(g.flag || '')}</span><h2 ${bind(gp + '.title', 'text', '그룹명')}>${esc(g.title)}</h2><span class="owner" ${bind(gp + '.owner', 'text', '담당자')}>${esc(g.owner || '')}</span><span class="spacer"></span>${E ? btn('del-group', gp, '× 그룹 삭제', '그룹 삭제 (섹션은 미분류로 이동)', 'icon danger') : ''}</div>`;
      let count = 0;
      secs.forEach((s, si) => { if (s.group === g.id) { count++; main += renderSection(s, `${base}.sections.${si}`); } });
      if (!count && !E) main += `<div class="empty">아직 내용이 없습니다.</div>`;
      if (E) main += addSectionBar(base, g.id);
      main += `</div>`;
    });
    // 미분류
    const orphans = secs.map((s, si) => [s, si]).filter(([s]) => s.group && !known.has(s.group));
    if (orphans.length) {
      main += `<div class="group" id="g-orphan"><div class="group-head"><span class="flag">📎</span><h2>미분류 섹션</h2></div>`;
      orphans.forEach(([s, si]) => { main += renderSection(s, `${base}.sections.${si}`); });
      main += `</div>`;
    }
    if (E) main += `<div class="add-bar" style="margin-top:24px">${btn('add-group', base, '+ 국가/그룹 추가', '', 'ghost')}</div>`;
    return { side, main, chips };
  }

  function addSectionBar(teamPath, group) {
    return `<div class="add-bar"><span class="lbl">섹션 추가:</span>
      ${btn('add-sec', teamPath, '+ 텍스트', '', 'ghost sm', `${group}|text`)}
      ${btn('add-sec', teamPath, '+ 표', '', 'ghost sm', `${group}|table`)}
      ${btn('add-sec', teamPath, '+ OKR', '', 'ghost sm', `${group}|okr`)}
      ${btn('add-sec', teamPath, '+ 하이라이트', '', 'ghost sm', `${group}|kpis`)}</div>`;
  }

  function renderSection(sec, path) {
    const E = state.edit;
    const r = { kpis: renderKpis, text: renderText, table: renderTable, okr: renderOkr }[sec.type];
    const body = r ? r(sec, path) : `<p class="empty">알 수 없는 섹션 유형: ${esc(sec.type)}</p>`;
    const showNote = sec.note || (E && sec.type === 'table');
    return `<section class="sec sec-${sec.type}">
      <div class="sec-head"><h3 ${bind(path + '.title', 'text', '섹션 제목')}>${esc(sec.title || '')}</h3>
        ${E ? `<div class="sec-tools">${btn('move-sec', path, '↑', '위로', 'icon', 'up')}${btn('move-sec', path, '↓', '아래로', 'icon', 'down')}${btn('del-sec', path, '×', '섹션 삭제', 'icon danger')}</div>` : ''}</div>
      ${showNote ? `<p class="sec-note" ${bind(path + '.note', 'text', '표 설명(선택)')}>${esc(sec.note || '')}</p>` : ''}
      ${body}</section>`;
  }

  function renderKpis(sec, path) {
    const E = state.edit;
    return `<div class="kpis">${(sec.items || []).map((k, i) => `<div class="kpi">
        <div class="v" ${bind(`${path}.items.${i}.value`, 'text', '값')}>${esc(k.value)}</div>
        <div class="l" ${bind(`${path}.items.${i}.label`, 'text', '지표명')}>${esc(k.label)}</div>
        <div class="s" ${bind(`${path}.items.${i}.sub`, 'text', '보조 설명')}>${esc(k.sub || '')}</div>
        ${E ? `<span class="del">${btn('del-kpi', `${path}.items.${i}`, '×', '삭제', 'icon danger')}</span>` : ''}</div>`).join('')}
      ${E ? `<div class="kpi" style="display:grid;place-items:center;border-style:dashed">${btn('add-kpi', `${path}.items`, '+ 지표 추가', '', 'ghost sm')}</div>` : ''}</div>`;
  }

  function renderText(sec, path) {
    return `<div class="rich" ${bind(path + '.html', 'html', '내용을 입력하세요')}>${sec.html || ''}</div>`;
  }

  function renderTable(sec, path) {
    const E = state.edit;
    const cols = sec.columns || [];
    const badgeCols = new Set(sec.badgeCols || []);
    const linkCol = Number.isInteger(sec.linkCol) ? sec.linkCol : null;
    if (linkCol !== null && !Array.isArray(sec.links)) sec.links = sec.rows.map(() => '');
    const head = cols.map((c, ci) => `<th ${bind(`${path}.columns.${ci}`, 'text', '열 이름')}>${esc(c)}${E ? `<span class="del-col">${btn('del-col', `${path}.columns.${ci}`, '×', '열 삭제', 'icon danger')}</span>` : ''}</th>`).join('')
      + (linkCol !== null && E ? `<th>링크 URL</th>` : '')
      + (E ? `<th class="act">${btn('add-col', path, '+', '열 추가', 'icon')}</th>` : '');
    const rows = (sec.rows || []).map((r, ri) => `<tr>${cols.map((_, ci) => {
      const v = r[ci] ?? '';
      const isNum = /^[\d.,%$£€+\-\s]+$/.test(v) && /\d/.test(v) && !/[가-힣a-zA-Z]/.test(v) && ci > 0;
      if (badgeCols.has(ci)) return `<td ${bind(`${path}.rows.${ri}.${ci}`)}>${E ? esc(v) : badge(v)}</td>`;
      if (linkCol === ci && !E && sec.links?.[ri]) return `<td><a class="lnk" href="${esc(sec.links[ri])}" target="_blank" rel="noopener">${esc(v)} ↗</a></td>`;
      return `<td class="${isNum ? 'num' : ''}" ${bind(`${path}.rows.${ri}.${ci}`)}>${esc(v)}</td>`;
    }).join('')}
      ${linkCol !== null && E ? `<td class="url" ${bind(`${path}.links.${ri}`, 'text', 'https://…')}>${esc(sec.links[ri] || '')}</td>` : ''}
      ${E ? `<td class="act">${btn('del-row', `${path}.rows.${ri}`, '×', '행 삭제', 'icon danger')}</td>` : ''}</tr>`).join('');
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${rows || (!E ? `<tr><td colspan="${cols.length}" class="empty">내용 없음</td></tr>` : '')}</tbody></table></div>
      ${E ? `<div class="add-bar">${btn('add-row', path, '+ 행 추가', '', 'ghost sm')}</div>` : ''}`;
  }

  function renderOkr(sec, path) {
    const E = state.edit;
    let h = '';
    (sec.objectives || []).forEach((o, oi) => {
      const op = `${path}.objectives.${oi}`;
      h += `<div class="obj"><div class="obj-head"><span class="chip obj-chip" ${bind(op + '.code', 'text', 'Object')}>${esc(o.code)}</span><div class="obj-title" ${bind(op + '.title', 'text', '목표(Objective)')}>${esc(o.title)}</div>${E ? btn('del-obj', op, '×', 'Objective 삭제', 'icon danger') : ''}</div>`;
      (o.krs || []).forEach((kr, ki) => {
        const kp = `${op}.krs.${ki}`;
        h += `<div class="kr"><div class="kr-head"><span class="chip kr-chip" ${bind(kp + '.code', 'text', 'KR')}>${esc(kr.code)}</span><div class="kr-title" ${bind(kp + '.title', 'text', '핵심 결과(Key Result)')}>${esc(kr.title)}</div>${E ? btn('del-kr', kp, '×', 'KR 삭제', 'icon danger') : ''}</div>`;
        const inits = kr.initiatives || [];
        if (inits.length) {
          h += `<div class="tbl-wrap"><table class="tbl compact init"><thead><tr><th style="width:36px">#</th><th>Initiative · Project</th><th style="width:130px">담당</th><th style="width:110px">기간</th><th style="width:150px">상태</th><th style="width:70px">링크</th><th style="width:28%">비고 / 결과</th>${E ? '<th class="act"></th>' : ''}</tr></thead><tbody>`;
          inits.forEach((it, ii) => {
            const ip = `${kp}.initiatives.${ii}`;
            h += `<tr><td class="mono" ${bind(ip + '.code', 'text', 'P#')}>${esc(it.code)}</td><td ${bind(ip + '.title', 'text', '과제')}>${esc(it.title)}</td><td ${bind(ip + '.owner', 'text', '담당')}>${esc(it.owner)}</td><td ${bind(ip + '.period', 'text', '기간')}>${esc(it.period)}</td><td>${statusCell(it.status, ip + '.status')}</td><td>${linkCell(it.link, ip + '.link')}</td><td class="note" ${bind(ip + '.note', 'text', '비고')}>${esc(it.note)}</td>${E ? `<td class="act">${btn('del-init', ip, '×', 'Initiative 삭제', 'icon danger')}</td>` : ''}</tr>`;
          });
          h += `</tbody></table></div>`;
        } else if (!E) {
          h += `<div class="kr-empty">등록된 Initiative 없음</div>`;
        }
        if (E) h += `<div class="add-bar">${btn('add-init', kp + '.initiatives', '+ Initiative 추가', '', 'ghost sm')}</div>`;
        h += `</div>`;
      });
      if (E) h += `<div class="add-bar">${btn('add-kr', op + '.krs', '+ Key Result 추가', '', 'ghost sm')}</div>`;
      h += `</div>`;
    });
    if (E) h += `<div class="add-bar">${btn('add-obj', path + '.objectives', '+ Objective 추가', '', 'ghost sm')}</div>`;
    return h || `<p class="empty">등록된 Objective가 없습니다.</p>`;
  }

  // ---------- interviews ----------
  function renderInterviews() {
    const iv = state.period.interviews || (state.period.interviews = { passwordHash: '', files: [] });
    if (!state.unlocked) {
      return `<div class="lock" id="lock"><div class="ico">🔒</div><h2>면담시트</h2><p>개인 면담 자료입니다. 비밀번호를 입력해 주세요.<br>이 탭은 들어올 때마다 비밀번호를 다시 확인합니다.</p>
        <form id="pw-form" autocomplete="off"><input id="pw" type="password" placeholder="비밀번호" autocomplete="off"><button class="btn primary" type="submit">열기</button></form><div class="msg" id="pw-msg"></div></div>`;
    }
    const E = state.edit;
    const teams = [...new Set(iv.files.map((f) => f.team))];
    let h = `<div class="iv-head"><h2>🔓 면담시트 <small>${iv.files.length}건</small></h2>
      ${btn('change-pw', '', '비밀번호 변경', '면담시트 비밀번호 변경', 'sm')}${btn('lock', '', '잠그기', '', 'sm')}</div>
      <p class="iv-note" ${bind('interviews.note', 'text', '안내 문구')}>${esc(iv.note || '')}</p>`;
    const group = (team) => {
      const rows = iv.files.map((f, i) => [f, i]).filter(([f]) => f.team === team);
      return `<div class="iv-team">${esc(team || '미분류')}</div><div class="sec" style="padding:0 0 4px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:90px">파트</th><th style="width:90px">이름</th><th>파일</th><th style="width:150px">최종 수정</th><th style="width:90px">열기</th><th>메모</th>${E ? '<th class="act"></th>' : ''}</tr></thead><tbody>`
        + rows.map(([f, i]) => {
          const p = `interviews.files.${i}`;
          const href = f.link || (f.file ? 'interviews/' + encodeURIComponent(f.file) : '');
          return `<tr><td ${bind(p + '.team', 'text', '파트')}>${esc(f.team)}</td><td><b ${bind(p + '.name', 'text', '이름')}>${esc(f.name)}</b></td>
            <td><span class="file-ico">X</span><span ${bind(p + '.file', 'text', '파일명.xlsx')}>${esc(f.file)}</span></td>
            <td class="mono" ${bind(p + '.updated', 'text', 'YYYY-MM-DD HH:MM')}>${esc(f.updated)}</td>
            <td>${E ? `<span class="url" ${bind(p + '.link', 'text', '외부 링크(선택)')}>${esc(f.link || '')}</span>` : (href ? `<a class="lnk" href="${esc(href)}" target="_blank" rel="noopener">열기 ↗</a>` : '<span class="dash">—</span>')}</td>
            <td ${bind(p + '.memo', 'text', '면담 메모')}>${esc(f.memo || '')}</td>${E ? `<td class="act">${btn('del-file', p, '×', '삭제', 'icon danger')}</td>` : ''}</tr>`;
        }).join('') + `</tbody></table></div></div>`;
    };
    teams.forEach((t) => { h += group(t); });
    if (!teams.length) h += `<p class="empty">등록된 면담시트가 없습니다.</p>`;
    if (E) h += `<div class="add-bar">${btn('add-file', 'interviews.files', '+ 면담시트 추가', '', 'ghost sm')}</div>`;
    return h;
  }

  async function tryUnlock(pw) {
    const hash = state.period.interviews?.passwordHash || '';
    const ok = hash && (await sha256Hex(pw)) === hash;
    if (ok) { state.unlocked = true; renderPeriod(); return; }
    const lock = $('#lock'); const msg = $('#pw-msg');
    if (msg) msg.textContent = '비밀번호가 올바르지 않습니다.';
    if (lock) { lock.classList.remove('shake'); void lock.offsetWidth; lock.classList.add('shake'); }
    const input = $('#pw'); if (input) { input.value = ''; input.focus(); }
  }
  async function changePassword() {
    const a = prompt('새 비밀번호를 입력하세요 (4자 이상)');
    if (a == null) return;
    if (a.length < 4) { alert('4자 이상 입력해 주세요.'); return; }
    const b = prompt('확인을 위해 한 번 더 입력하세요');
    if (b !== a) { alert('두 입력이 일치하지 않습니다.'); return; }
    state.period.interviews.passwordHash = await sha256Hex(a);
    save();
    alert('비밀번호가 변경되었습니다.\n※ 팀 전체에 적용하려면 JSON 내보내기 후 data 파일을 교체해 커밋해야 합니다.');
  }

  // ---------- actions ----------
  function newSection(type, group) {
    const g = group ? { group } : {};
    switch (type) {
      case 'text': return { ...g, type, title: '새 텍스트 섹션', html: '<p>내용을 입력하세요.</p>' };
      case 'table': return { ...g, type, title: '새 표', columns: ['항목', '내용', '비고'], rows: [['', '', '']] };
      case 'okr': return { ...g, type, title: 'OKR', objectives: [{ code: 'Object 1', title: '목표를 입력하세요', krs: [{ code: 'KR 1', title: '핵심 결과를 입력하세요', initiatives: [] }] }] };
      case 'kpis': return { ...g, type, title: '하이라이트', items: [{ label: '지표명', value: '0', sub: '' }] };
    }
    return { ...g, type: 'text', title: '새 섹션', html: '' };
  }
  function moveSection(path, dir) {
    const [pp, i] = parentOf(path);
    const arr = getP(state.period, pp);
    const g = arr[i].group || '';
    let j = i + (dir === 'up' ? -1 : 1);
    while (j >= 0 && j < arr.length && (arr[j].group || '') !== g) j += (dir === 'up' ? -1 : 1);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(state.period, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${state.periodId}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importJson(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!data.id || !periodMeta(data.id) || !Array.isArray(data.teams)) throw new Error('OKR 보고서 JSON 형식이 아닙니다.');
        localStorage.setItem(STORE + data.id, JSON.stringify(data));
        state.periodId = null; // 강제 재로드
        go(data.id, state.tab && state.tab !== TAB_INTERVIEWS ? state.tab : undefined);
        onRoute();
      } catch (e) { alert('불러오기 실패: ' + e.message); }
    };
    rd.readAsText(file, 'utf-8');
  }

  function handleAction(act, path, arg) {
    const P = state.period;
    const y = window.scrollY;
    switch (act) {
      case 'toggle-edit': state.edit = !state.edit; if (!state.edit) save(); break;
      case 'export': exportJson(); return;
      case 'import': $('#file-import').click(); return;
      case 'reset':
        if (confirm('이 브라우저에 저장된 수정본을 삭제하고 원본 데이터로 되돌립니다. 계속할까요?')) { localStorage.removeItem(STORE + state.periodId); state.periodId = null; onRoute(); }
        return;
      case 'print': window.print(); return;
      case 'lock': state.unlocked = false; break;
      case 'change-pw': changePassword(); return;
      case 'add-row': { const sec = getP(P, path); sec.rows.push(sec.columns.map(() => '')); if (sec.links) sec.links.push(''); break; }
      case 'del-row': { const [pp, i] = parentOf(path); const sec = getP(P, pp.replace(/\.rows$/, '')); sec.rows.splice(i, 1); if (sec.links) sec.links.splice(i, 1); break; }
      case 'add-col': { const sec = getP(P, path); sec.columns.push('새 열'); sec.rows.forEach((r) => r.push('')); break; }
      case 'del-col': {
        const [pp, i] = parentOf(path); const sec = getP(P, pp.replace(/\.columns$/, ''));
        if (sec.columns.length <= 1) return;
        sec.columns.splice(i, 1); sec.rows.forEach((r) => r.splice(i, 1));
        sec.badgeCols = (sec.badgeCols || []).filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
        if (sec.linkCol === i) delete sec.linkCol; else if (sec.linkCol > i) sec.linkCol--;
        break;
      }
      case 'add-kpi': getP(P, path).push({ label: '지표명', value: '0', sub: '' }); break;
      case 'add-init': getP(P, path).push({ code: '', title: '새 Initiative', owner: '', period: '', status: 'Not Started', link: '', note: '' }); break;
      case 'add-kr': getP(P, path).push({ code: 'KR', title: '새 Key Result', initiatives: [] }); break;
      case 'add-obj': getP(P, path).push({ code: 'Object', title: '새 Objective', krs: [] }); break;
      case 'add-member': getP(P, path).push({ name: '이름', role: '역할', scope: '담당 국가/영역' }); break;
      case 'add-file': getP(P, path).push({ team: '', name: '', file: '', updated: '', link: '', memo: '' }); break;
      case 'add-sec': { const [group, type] = String(arg).split('|'); getP(P, path + '.sections').push(newSection(type, group)); break; }
      case 'add-group': { const t = getP(P, path); (t.groups || (t.groups = [])).push({ id: 'g' + Date.now().toString(36), title: '새 그룹', flag: '📌', owner: '' }); break; }
      case 'move-sec': moveSection(path, arg); break;
      case 'del-kpi': case 'del-init': case 'del-kr': case 'del-obj': case 'del-member': case 'del-file': case 'del-sec': case 'del-group': {
        if (/del-(obj|sec|group)/.test(act) && !confirm('삭제할까요? 되돌릴 수 없습니다.')) return;
        const [pp, i] = parentOf(path); getP(P, pp).splice(i, 1); break;
      }
      default: return;
    }
    save();
    renderPeriod();
    window.scrollTo(0, y);
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a) { e.preventDefault(); handleAction(a.dataset.action, a.dataset.path, a.dataset.arg); return; }
    const s = e.target.closest('[data-scroll]');
    if (s) { e.preventDefault(); const el = document.getElementById(s.dataset.scroll); if (el) { const top = el.getBoundingClientRect().top + window.scrollY - 170; window.scrollTo({ top, behavior: 'smooth' }); } }
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest?.('[data-bind]');
    if (!el || !state.period) return;
    const kind = el.dataset.kind || 'text';
    const v = kind === 'html' ? el.innerHTML : el.innerText.replace(/\n$/, '');
    setP(state.period, el.dataset.bind, v);
    scheduleSave();
  });
  document.addEventListener('change', (e) => {
    const s = e.target.closest('[data-select]');
    if (s) { setP(state.period, s.dataset.select, s.value); save(); const y = window.scrollY; renderPeriod(); window.scrollTo(0, y); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'pw-form') { e.preventDefault(); tryUnlock($('#pw').value); }
  });
  document.addEventListener('keydown', (e) => {
    // 단일 줄 필드에서 Enter → 줄바꿈 대신 포커스 해제 (표 셀은 Shift+Enter로 줄바꿈)
    const el = e.target.closest?.('[data-bind][data-kind="text"]');
    if (el && e.key === 'Enter' && !e.shiftKey && el.tagName !== 'TD') { e.preventDefault(); el.blur(); }
  });
  $('#file-import').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; });
  window.addEventListener('hashchange', onRoute);
  window.addEventListener('beforeunload', () => { if (state.saveTimer) { clearTimeout(state.saveTimer); save(); } });

  onRoute();
})();
