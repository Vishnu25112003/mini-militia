// DOM screens from the contact sheet: home, join, lobby, popups, leaderboards, system messages, HUD panels.
import { assets, sprite, spriteURL } from './assets.js';
import { drawAvatar, drawSoldier } from './soldier.js';
import { stepperRow, toggleRow } from './ui.js';
import { GUNS, NADES, CATEGORIES, ALL_GUNS, isDual, itemSprite } from '/shared/weapons.js';
import { MODES, SPECIALS, GRAVITY_STEPS, BOOST_STEPS, DROP_STEPS, RESPAWN_STEPS } from '/shared/config.js';

const $ = (id) => document.getElementById(id);
export const COLORS = ['#ff4b3e', '#b05cff', '#ffd23f', '#3fd4ff', '#5ee05a', '#ff9a2e', '#ff6fc3', '#f2f2f2'];
export const TEAM = [{ name: 'Blue', color: '#2f7df6' }, { name: 'Orange', color: '#ff8a1e' }];
const AVATAR_PARTS = [['head', 'Head', 17], ['body', 'Body', 18], ['leg', 'Legs', 17], ['arm', 'Arms', 18]];
const ICON = {
  warn: '<svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true"><path d="M12 2 1 21h22z" fill="#e0352b"/><path d="M12 9v5M12 17v1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" fill="none" stroke="#e0352b" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.8" fill="#e0352b"/></svg>',
  spin: '<div class="spinner"></div>',
};
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const crownSvg = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';

export class Screens {
  constructor({ state, send, net, profile, saveProfile, onLeave, openControls }) {
    Object.assign(this, { state, send, net, profile, saveProfile, onLeave, openControls });
    this.unread = 0;
    this.countdownEnd = 0;
    this.loadoutSlot = 0;
    this.loadoutTab = 'all';
    this.chatOpen = false;
    this.bindPopups();
    this.bindHome();
    this.bindJoin();
    this.bindLobby();
    setInterval(() => this.tickCountdown(), 250);
  }

  // ---------------- art from the game files ----------------
  // The real Catacombs map, dimmed, as the menu backdrop; its rock as the title's stone texture.
  paintBackdrops(map, minimap) {
    const T = map.tile, ts = map.tileset, img = assets.img.tile64Desert_new;
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 900;
    const g = c.getContext('2d');
    g.fillStyle = '#16100a'; g.fillRect(0, 0, c.width, c.height);
    const k = 0.62, ox = map.width * T * 0.5 - c.width / k / 2, oy = map.height * T * 0.42 - c.height / k / 2;
    for (const layer of [map.layers.tilebg, map.layers.tile]) {
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        const gid = layer[y * map.width + x];
        if (!gid) continue;
        const dx = (x * T - ox) * k, dy = (y * T - oy) * k;
        if (dx < -T || dy < -T || dx > c.width || dy > c.height) continue;
        const i = gid - 1;
        g.drawImage(img, ts.margin + (i % ts.cols) * (ts.size + ts.spacing), ts.margin + Math.floor(i / ts.cols) * (ts.size + ts.spacing), ts.size, ts.size, dx, dy, T * k + 1, T * k + 1);
      }
    }
    document.body.style.setProperty('--map-image', `url(${c.toDataURL('image/jpeg', 0.8)})`);
    // stone: a rock tile, desaturated
    const s = document.createElement('canvas');
    s.width = s.height = 128;
    const sg = s.getContext('2d');
    sg.filter = 'grayscale(1) brightness(1.25) contrast(1.15)';
    const i = 50; // the solid rock fill used all over Catacombs (gid 51)
    sg.drawImage(img, ts.margin + (i % ts.cols) * (ts.size + ts.spacing), ts.margin + Math.floor(i / ts.cols) * (ts.size + ts.spacing), 128, 128, 0, 0, 128, 128);
    $('title').style.setProperty('--stone', `url(${s.toDataURL()})`);
    // lobby map card
    const thumb = $('map-thumb');
    thumb.getContext('2d').drawImage(minimap, 0, 0, thumb.width, thumb.height);
  }

  // ---------------- screen switching ----------------
  navigate(view) { (this.onNavigate || this.show.bind(this))(view); }

  show(name) {
    for (const id of ['home', 'join', 'lobby']) $(`screen-${id}`).hidden = id !== name;
    document.body.classList.toggle('menu', ['home', 'join', 'lobby'].includes(name));
    $('hud').hidden = name !== 'game';
    if (name !== 'game') this.hideBoard();
    if (name !== 'lobby' && name !== 'game') this.closeAll();
  }

  // ---------------- 2. home ----------------
  bindHome() {
    const name = $('name');
    name.value = this.profile.name;
    const check = () => {
      const v = name.value.trim();
      const hint = $('name-hint');
      let msg = 'Looks good!', bad = false;
      if (!v) { msg = 'Pick a name to play'; bad = true; }
      else if (v.length < 2) { msg = 'At least 2 characters'; bad = true; }
      else if (!/^[\w .'-]+$/.test(v)) { msg = 'Letters, numbers, space, . \' - only'; bad = true; }
      hint.textContent = msg;
      hint.classList.toggle('bad', bad);
      return !bad;
    };
    name.addEventListener('input', check);
    check();
    $('name-clear').onclick = () => { name.value = ''; check(); name.focus(); };
    const go = (action) => {
      if (!check()) { name.focus(); return; }
      this.profile.name = name.value.trim();
      this.saveProfile();
      action();
    };
    $('create-room').onclick = () => go(() => this.onCreate());
    $('join-room').onclick = () => go(() => { this.navigate('join'); $('join-error').hidden = true; $('code').focus(); });
    $('home-form').onsubmit = (e) => { e.preventDefault(); $('create-room').click(); };
    const left = $('home-left');
    const openAvatar = () => this.openAvatar();
    left.onclick = openAvatar;
    left.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') openAvatar(); };
  }

  drawHomeSoldiers() {
    const pose = (canvas, avatar, w) => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      const k = canvas.height / 70;
      ctx.translate(canvas.width / 2, canvas.height - 10 * k);
      ctx.scale(k, k);
      drawSoldier(ctx, { x: 0, y: 0, vx: 0, aim: -0.12, c: 0, g: 0, j: 1, w, avatar, team: -1, fl: -1, phase: 0 }, performance.now() / 1000);
      ctx.restore();
    };
    pose($('home-left'), this.profile.avatar, 'ak47');
    pose($('home-right'), { head: 2, body: 2, leg: 2, arm: 2 }, 'mp5');
  }

  openAvatar() {
    const box = $('avatar-parts');
    box.innerHTML = '';
    for (const [key, label, max] of AVATAR_PARTS) {
      box.append(stepperRow(label, Array.from({ length: max }, (_, i) => i + 1), this.profile.avatar[key], String, (v) => {
        this.profile.avatar[key] = v;
        this.saveProfile();
        drawAvatar($('avatar-preview'), this.profile.avatar, -1);
        this.drawHomeSoldiers();
        this.send({ t: 'profile', name: this.profile.name, avatar: this.profile.avatar });
        this.openAvatar();
      }));
    }
    drawAvatar($('avatar-preview'), this.profile.avatar, -1);
    this.open('pop-avatar');
  }

  // ---------------- 3. join ----------------
  bindJoin() {
    const code = $('code');
    code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); $('join-error').hidden = true; });
    $('code-clear').onclick = () => { code.value = ''; code.focus(); };
    $('join-back').onclick = () => this.navigate('home');
    $('join-form').onsubmit = (e) => {
      e.preventDefault();
      if (code.value.length < 6) return this.joinError('Enter the 6-character code', 'The host sees it in their lobby.');
      this.onJoin(code.value);
    };
  }

  joinError(title, text) {
    $('join-error-title').textContent = title;
    $('join-error-text').textContent = text;
    $('join-error').hidden = false;
  }

  // ---------------- 4. lobby ----------------
  bindLobby() {
    $('copy-code').onclick = () => this.copy(this.state.code, $('copy-code'));
    $('share-code').onclick = () => this.share();
    $('start-btn').onclick = () => this.send({ t: 'start' });
    $('ready-btn').onclick = () => {
      const me = this.me();
      this.send({ t: 'ready', v: !me?.ready });
    };
    $('leave-btn').onclick = () => this.onLeave();
    $('settings-btn').onclick = () => this.openMatchSettings();
    $('map-card').onclick = () => this.openMatchSettings();
    $('lobby-chat-btn').onclick = () => this.openChat();
  }

  me() { return this.state.lobby?.players.find((p) => p.id === this.state.myId); }

  renderLobby() {
    const L = this.state.lobby;
    if (!L) return;
    const me = this.me();
    const isHost = !!me?.host;
    const mode = MODES[L.config.mode];
    $('player-count').textContent = `(${L.players.length}/${L.config.maxPlayers})`;
    $('room-code').textContent = L.code || this.state.code || '';
    const list = $('players');
    list.innerHTML = '';
    for (const p of L.players) {
      const li = document.createElement('li');
      li.className = `player${p.id === this.state.myId ? ' me' : ''}`;
      const state = !p.connected ? ['away', 'Reconnecting'] : p.ready ? ['ready', 'Ready'] : ['not', 'Not ready'];
      li.innerHTML = `<span class="crown">${p.host ? crownSvg : ''}</span><span class="dot" style="background:${COLORS[p.color] || '#fff'}"></span><img alt="" src="${spriteURL(`head${p.avatar.head}`)}"><span class="name"></span>${mode.teams ? `<span class="team" style="background:${TEAM[p.team].color}">${TEAM[p.team].name}</span>` : '<span></span>'}<span class="state ${state[0]}">${p.host ? '<span class="tag">Host</span> ' : ''}${state[1]}</span><span></span>`;
      li.querySelector('.name').textContent = p.name;
      if (isHost && p.id !== this.state.myId) {
        const k = document.createElement('button');
        k.className = 'kick'; k.type = 'button';
        k.setAttribute('aria-label', `Remove ${p.name} from the room`);
        k.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3 13 13M13 3 3 13" stroke="currentColor" stroke-width="3"/></svg>';
        k.onclick = () => this.send({ t: 'kick', id: p.id });
        li.lastElementChild.replaceWith(k);
      }
      list.append(li);
    }
    // team switch for team modes
    let sw = list.parentElement.querySelector('.team-switch');
    if (mode.teams && me) {
      if (!sw) { sw = document.createElement('div'); sw.className = 'team-switch'; list.after(sw); }
      sw.innerHTML = '';
      const other = 1 - me.team;
      const b = document.createElement('button');
      b.className = 'btn btn-small'; b.type = 'button';
      b.textContent = `Join ${TEAM[other].name}`;
      b.style.background = TEAM[other].color;
      b.onclick = () => this.send({ t: 'team', team: other });
      sw.append(b);
    } else sw?.remove();

    const ready = L.players.filter((p) => p.connected && p.ready).length;
    $('lobby-wait').textContent = L.phase === 'playing' ? 'Match in progress — you will drop in shortly'
      : L.phase === 'over' ? 'Match over — results on screen'
      : L.players.length < 2 ? 'Waiting for players to join…'
      : ready < L.players.length ? `${ready} of ${L.players.length} ready` : 'Everyone is ready!';
    this.countdownEnd = L.startsIn == null ? 0 : performance.now() + L.startsIn * 1000;
    this.tickCountdown();
    $('start-btn').hidden = !isHost;
    $('start-btn').disabled = L.phase !== 'lobby';
    $('ready-btn').hidden = isHost;
    $('ready-btn').setAttribute('aria-pressed', String(!!me?.ready));
    $('ready-btn').textContent = me?.ready ? 'Ready ✓' : 'Ready';
    $('map-mode').textContent = mode.name;
    $('map-players').textContent = `Players: ${L.players.length} / ${L.config.maxPlayers}`;
    $('map-time').textContent = `Game Time: ${mmss(L.config.minutes * 60)}`;
    $('settings-btn').setAttribute('aria-label', isHost ? 'Match settings' : 'View match settings');
    if (!$('pop-settings').hidden) this.renderMatchSettings();
    if (!$('pop-loadout').hidden) this.renderLoadout();
  }

  tickCountdown() {
    const el = $('countdown');
    if (!el || $('screen-lobby').hidden) return;
    if (!this.countdownEnd) { el.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((this.countdownEnd - performance.now()) / 1000));
    el.innerHTML = `Match starts in <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>`;
  }

  async copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement('textarea');
      t.value = text; document.body.append(t); t.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      t.remove();
    }
    if (btn) { const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1200); }
  }

  inviteText() { return `Join my Catacombs room ${this.state.code} — open ${this.state.urls?.[0] || location.origin} on the same Wi-Fi.`; }

  async share() {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: 'Catacombs', text: this.inviteText() }); return; } catch { /* fall through to the sheet */ }
    }
    $('share-url').textContent = this.state.urls?.[0] || location.origin;
    $('share-code').textContent = this.state.code;
    $('qr').src = `qr.svg?${Date.now()}`;
    $('share-copy').onclick = () => this.copy(this.inviteText(), $('share-copy'));
    this.open('pop-share');
  }

  // ---------------- popups ----------------
  bindPopups() {
    for (const el of document.querySelectorAll('#popups .overlay')) {
      el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) this.close(el.id); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(el.id); } });
    }
  }

  open(id) {
    const el = $(id);
    el.hidden = false;
    this.onPopup?.(true);
    requestAnimationFrame(() => (el.querySelector('input, [data-close], button') || el).focus?.());
  }

  close(id) {
    $(id).hidden = true;
    if (id === 'pop-chat') this.chatOpen = false;
    if (!this.anyOpen()) this.onPopup?.(false);
  }

  closeAll() { for (const el of document.querySelectorAll('#popups .overlay')) el.hidden = true; this.chatOpen = false; this.onPopup?.(false); }
  anyOpen() { return [...document.querySelectorAll('#popups .overlay')].some((el) => !el.hidden); }

  // 5. match settings (host edits, everyone else reads)
  openMatchSettings() { this.renderMatchSettings(); this.open('pop-settings'); }

  renderMatchSettings() {
    const L = this.state.lobby;
    if (!L) return;
    const C = L.config, isHost = !!this.me()?.host, ro = { disabled: !isHost || L.phase === 'playing' };
    const set = (patch) => this.send({ t: 'config', ...patch });
    const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const mode = MODES[C.mode];
    $('host-only').textContent = isHost ? '(host only)' : '(set by the host)';
    const rows = $('match-rows');
    rows.innerHTML = '';
    rows.append(
      stepperRow('Game mode', Object.keys(MODES), C.mode, (m) => MODES[m].name, (v) => set({ mode: v }), ro),
      stepperRow('Player count', range(2, 12), C.maxPlayers, String, (v) => set({ maxPlayers: v }), ro),
      stepperRow('Game time', range(2, 30), C.minutes, (v) => mmss(v * 60), (v) => set({ minutes: v }), ro),
      stepperRow(mode.limitLabel, range(1, 99), C.limit, String, (v) => set({ limit: v }), ro),
      stepperRow('Map drops (disappear time)', DROP_STEPS, C.drops, (v) => (v ? `${v} sec` : 'Off'), (v) => set({ drops: v }), ro),
      stepperRow('Gravity', GRAVITY_STEPS, C.gravity, (v) => String(Math.round(v * 100)), (v) => set({ gravity: v }), ro),
      stepperRow('Boost', BOOST_STEPS, C.boost, (v) => (v < 0 ? 'Max' : String(v)), (v) => set({ boost: v }), ro),
      stepperRow('Respawn time', RESPAWN_STEPS, C.respawn, (v) => `${v} sec`, (v) => set({ respawn: v }), ro),
      toggleRow('Health regen', C.healthRegen, (v) => set({ healthRegen: v }), ro),
    );
    if (mode.teams) rows.append(toggleRow('Friendly fire', C.friendlyFire, (v) => set({ friendlyFire: v }), ro));
    const dl = toggleRow('Default loadout', C.defaultLoadout, (v) => set({ defaultLoadout: v }), { ...ro, hint: C.defaultLoadout ? 'Everyone spawns with the host loadout' : 'Each soldier picks their own' });
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'btn btn-small';
    edit.textContent = C.defaultLoadout ? (isHost ? 'Edit' : 'View') : 'My loadout';
    edit.onclick = () => this.openLoadout();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;align-items:center';
    wrap.append(edit, dl.lastElementChild);
    dl.append(wrap);
    rows.append(dl);
    const chips = $('specials');
    chips.innerHTML = '';
    for (const [id, sp] of Object.entries(SPECIALS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      const on = C.specials.includes(id);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = sp.name; b.title = sp.info;
      b.disabled = ro.disabled;
      b.onclick = () => set({ specials: on ? C.specials.filter((x) => x !== id) : [...C.specials, id] });
      chips.append(b);
    }
  }

  // 6. loadout picker: host default (DEFAULT LOADOUT on) or the player's own (off)
  openLoadout() { this.renderLoadout(); this.open('pop-loadout'); }

  loadoutSource() {
    const C = this.state.lobby?.config;
    const own = C && !C.defaultLoadout;
    return { own, editable: own || !!this.me()?.host, L: own ? this.state.myLoadout || C.loadout : C.loadout };
  }

  setLoadout(patch) {
    const { own, L } = this.loadoutSource();
    if (own) { this.state.myLoadout = { ...L, ...patch }; this.saveMyLoadout?.(this.state.myLoadout); this.send({ t: 'loadout', loadout: this.state.myLoadout }); this.renderLoadout(); }
    else this.send({ t: 'config', loadout: patch });
  }

  renderLoadout() {
    const { own, editable, L } = this.loadoutSource();
    $('pop-loadout-title').textContent = own ? 'Select Your Loadout' : 'Select Default Loadout';
    const slots = $('loadout-slots');
    slots.innerHTML = '';
    [['primary', 'primaryDual'], ['secondary', 'secondaryDual']].forEach(([k, dk], i) => {
      const t = L[k], dual = L[dk];
      const b = document.createElement('div');
      b.className = 'slot'; b.role = 'button'; b.tabIndex = 0;
      b.setAttribute('aria-pressed', String(this.loadoutSlot === i));
      const icon = `<img alt="" src="${spriteURL(GUNS[t].sprite)}">`;
      b.innerHTML = `<span class="slot-label">Slot ${i + 1}</span><span class="slot-guns">${icon}${dual ? icon : ''}</span><span class="slot-name"></span>`;
      b.querySelector('.slot-name').textContent = dual ? `${GUNS[t].name} + ${GUNS[t].name}` : GUNS[t].name;
      b.onclick = () => { this.loadoutSlot = i; this.renderLoadout(); };
      b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') b.click(); };
      if (isDual(t)) {
        const pair = document.createElement('button');
        pair.type = 'button'; pair.className = 'pair';
        pair.textContent = dual ? 'Pair: on' : 'Pair: off';
        pair.setAttribute('aria-pressed', String(!!dual));
        pair.disabled = !editable;
        pair.onclick = (e) => { e.stopPropagation(); this.setLoadout({ [dk]: !dual }); };
        b.append(pair);
      }
      slots.append(b);
    });
    const tabs = $('loadout-tabs');
    tabs.innerHTML = '';
    for (const [id, name] of [['all', 'All'], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.name])]) {
      const b = document.createElement('button');
      b.type = 'button'; b.role = 'tab';
      b.setAttribute('aria-selected', String(this.loadoutTab === id));
      b.textContent = name;
      b.onclick = () => { this.loadoutTab = id; this.renderLoadout(); };
      tabs.append(b);
    }
    const grid = $('gun-grid');
    grid.innerHTML = '';
    const list = this.loadoutTab === 'all' ? ALL_GUNS : CATEGORIES[this.loadoutTab].guns;
    const key = this.loadoutSlot ? 'secondary' : 'primary', otherKey = this.loadoutSlot ? 'primary' : 'secondary';
    for (const t of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gun';
      b.setAttribute('aria-pressed', String(L[key] === t));
      b.innerHTML = `<img alt="" src="${spriteURL(GUNS[t].sprite)}"><span></span>`;
      b.querySelector('span').textContent = GUNS[t].name;
      b.disabled = !editable || L[otherKey] === t;
      b.onclick = () => this.setLoadout({ [key]: t, ...(isDual(t) ? {} : { [`${key}Dual`]: false }) });
      grid.append(b);
    }
    const nades = $('loadout-nades');
    nades.innerHTML = '';
    if (!own) {
      for (const [k, label] of [['fragnade', 'Frag'], ['gasnade', 'Gas'], ['proxynade', 'Proxy']]) {
        nades.append(stepperRow(label, [0, 1, 2, 3], L[k], String, (v) => this.setLoadout({ [k]: v }), { disabled: !editable }));
      }
    }
  }

  // 7. chat
  openChat() {
    this.chatOpen = true;
    this.unread = 0;
    this.renderBadges();
    this.open('pop-chat');
    const log = $('chat-log');
    log.scrollTop = log.scrollHeight;
    $('chat-form').onsubmit = (e) => {
      e.preventDefault();
      const input = $('chat-input');
      const text = input.value.trim();
      if (text) this.send({ t: 'chat', text });
      input.value = '';
    };
  }

  addChat(m, quiet = false) {
    const log = $('chat-log');
    const li = document.createElement('li');
    const teams = MODES[this.state.lobby?.config.mode]?.teams;
    const b = document.createElement('b');
    b.textContent = `${m.name}:`;
    b.style.color = teams ? TEAM[m.team]?.color : COLORS[m.color] || '#fff';
    li.append(b, document.createTextNode(m.text));
    log.append(li);
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (!quiet && !this.chatOpen && m.id !== this.state.myId) { this.unread++; this.renderBadges(); }
  }

  renderBadges() {
    for (const id of ['lobby-chat-badge', 'hud-chat-badge']) {
      const el = $(id);
      el.hidden = !this.unread;
      el.textContent = this.unread > 9 ? '9+' : this.unread;
    }
  }

  // 9. replace which gun
  openReplace(choice) {
    const set = (id, type, hand) => {
      const b = $(id);
      b.querySelector('img').src = spriteURL(GUNS[type].sprite);
      b.querySelector('b').textContent = GUNS[type].name;
      b.onclick = () => { this.send({ t: 'replaceGun', item: choice.item, hand }); this.close('pop-replace'); };
    };
    set('replace-main', choice.main, 'main');
    set('replace-off', choice.off, 'off');
    $('replace-hint').textContent = `You are changing one gun from this pair for the ${GUNS[choice.type].name}. Select which gun to replace.`;
    this.open('pop-replace');
  }

  // ---------------- 10/11. leaderboards ----------------
  rowsFrom(players, { teams }) {
    const tb = $('board-rows');
    tb.innerHTML = '';
    players.forEach((p, i) => {
      const tr = document.createElement('tr');
      if (p.id === this.state.myId) tr.className = 'me';
      if (p.win) tr.className += ' win';
      const color = teams ? TEAM[p.team]?.color : COLORS[p.color];
      tr.innerHTML = `<td>${i + 1}${p.win ? ` <span style="color:var(--gold)">${crownSvg}</span>` : ''}</td><td><span class="dot" style="background:${color}"></span><span class="n"></span></td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.points}</td>`;
      tr.querySelector('.n').textContent = p.name;
      tb.append(tr);
    });
  }

  fromSnap(snap) {
    return [...snap.players].map((p) => ({ id: p.id, name: this.state.lobby?.players.find((q) => q.id === p.id)?.name || '?', team: p.t, color: p.col, kills: p.k, deaths: p.d, points: p.pts ?? p.k * 100 }))
      .sort((a, b) => b.points - a.points || a.deaths - b.deaths);
  }

  showRespawnBoard(snap, seconds) {
    const el = $('board');
    el.className = 'overlay board';
    el.hidden = false;
    $('board-title').textContent = seconds > 0 ? `Respawning in ${Math.ceil(seconds)}…` : 'Respawning…';
    $('board-sub').hidden = true;
    this.rowsFrom(this.fromSnap(snap), { teams: MODES[this.state.config.mode].teams });
    this.boardActions([['Controls', 'btn-blue', () => this.openControls()]], 'respawn');
  }

  showLiveBoard(snap) {
    const el = $('board');
    el.className = 'overlay board live';
    el.hidden = false;
    $('board-title').textContent = 'Live leaderboard';
    $('board-sub').hidden = true;
    this.rowsFrom(this.fromSnap(snap), { teams: MODES[this.state.config.mode].teams });
    this.boardActions([], 'live');
  }

  showFinalBoard(m) {
    const el = $('board');
    el.className = 'overlay board';
    el.hidden = false;
    const teams = MODES[m.mode].teams;
    $('board-title').textContent = 'Match over';
    const sub = $('board-sub');
    sub.hidden = false;
    if (teams) sub.textContent = m.winner < 0 ? `Draw ${m.teamScore[0]} – ${m.teamScore[1]}` : `${TEAM[m.winner].name} team wins! ${m.teamScore[0]} – ${m.teamScore[1]}`;
    else sub.textContent = m.players[0] ? `${m.players[0].id === this.state.myId ? 'You' : m.players[0].name} win${m.players[0].id === this.state.myId ? '' : 's'}!` : '';
    const rows = m.players.map((p, i) => ({ ...p, win: teams ? p.team === m.winner : i === 0 }));
    this.rowsFrom(rows, { teams });
    const isHost = !!this.me()?.host;
    this.boardActions([
      ['Controls', 'btn-blue', () => this.openControls()],
      ['Play again', 'btn-green', () => { this.send({ t: 'playAgain' }); if (!isHost) this.onBackToLobby?.(); }],
      ['Back to lobby', 'btn-blue', () => { if (isHost) this.send({ t: 'toLobby' }); this.onBackToLobby?.(); }],
    ], 'final');
  }

  boardActions(list, kind) {
    const box = $('board-actions');
    if (box.dataset.kind === kind && kind !== 'final') return;
    box.dataset.kind = kind;
    box.innerHTML = '';
    for (const [label, cls, fn] of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `btn ${cls}`;
      b.textContent = label;
      b.onclick = fn;
      box.append(b);
    }
  }

  hideBoard() { $('board').hidden = true; $('board-actions').dataset.kind = ''; }
  boardKind() { return $('board').hidden ? null : $('board-actions').dataset.kind; }

  // ---------------- 13. system messages ----------------
  system(kind, onOk) {
    const el = $('system');
    const box = {
      kicked: [ICON.warn, 'You were removed from the room', '', 'OK'],
      cancelled: [ICON.warn, 'Room cancelled by host', '', 'OK'],
      reconnecting: [ICON.spin, 'Reconnecting…', 'Please wait', null],
      disconnected: [ICON.wifi, 'Disconnected', '', 'Tap to rejoin'],
      full: [ICON.warn, 'Room is full', '', 'OK'],
      gone: [ICON.warn, 'That room has closed', '', 'OK'],
    }[kind];
    if (!box) { el.hidden = true; return; }
    $('system-icon').innerHTML = box[0];
    $('system-text').textContent = box[1];
    $('system-sub').textContent = box[2];
    const btn = $('system-btn');
    btn.hidden = !box[3];
    btn.textContent = box[3] || '';
    btn.onclick = () => { el.hidden = true; onOk?.(); };
    el.hidden = false;
    if (box[3]) btn.focus();
  }

  hideSystem() { $('system').hidden = true; }

  // ---------------- 8. HUD panels ----------------
  updateHud(me, snap, zoomOn, gunZoom) {
    if (!me) return;
    const hp = Math.max(0, me.hp) / 100;
    $('hp-fill').style.transform = `scaleX(${hp})`;
    $('hp-fill').parentElement.parentElement.classList.toggle('low', hp <= 0.35);
    $('boost-fill').style.transform = `scaleX(${me.boost > 0 ? 1 : Math.max(0, me.fuel ?? 1)})`;
    const t = snap.time;
    $('timer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const ts = $('team-score');
    if (MODES[this.state.config.mode].teams) {
      ts.hidden = false;
      ts.innerHTML = `<span style="background:${TEAM[0].color}">${snap.ts[0]}</span> <span style="background:${TEAM[1].color}">${snap.ts[1]}</span>`;
    } else ts.hidden = true;
    $('zoom-chip').textContent = zoomOn && gunZoom ? `${gunZoom}X` : '1X';
    $('zoom-chip').disabled = !gunZoom;
    if (!me.alive) return;
    const type = me.slots[me.slot], g = GUNS[type], a = me.guns[type];
    const off = me.off?.[me.slot];
    setImg($('weapon-icon'), g ? spriteURL(g.sprite) : '');
    const i2 = $('weapon-icon2');
    i2.hidden = !off;
    if (off) setImg(i2, spriteURL(GUNS[off.type].sprite));
    const pad = (n) => String(Math.min(999, n)).padStart(3, '0');
    let ammo = '';
    if (g && g.kind !== 'shield' && a) {
      const offGun = off && GUNS[off.type]?.kind !== 'shield' ? off : null;
      ammo = `${pad(a.mag + (offGun?.mag || 0))} / ${pad(a.reserve + (offGun?.reserve || 0))}`;
    } else ammo = 'Shield';
    $('ammo').textContent = ammo;
    let status = '';
    if (me.reload > 0) status = 'Reloading';
    else if (a && g?.kind !== 'shield' && a.mag === 0 && a.reserve === 0) status = 'No ammo';
    $('weapon-status').textContent = status;
    const sel = me.nadeSel;
    setImg($('nade-icon'), spriteURL(sel === 'proxynade' ? 'mine1' : NADES[sel]?.sprite || 'grenade'));
    $('nade-count').textContent = me.nades?.[sel] || 0;
  }
}

function setImg(img, src) { if (img.dataset.src !== src) { img.dataset.src = src; img.src = src || img.src; } }

export { itemSprite, sprite };
