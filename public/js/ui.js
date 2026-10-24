// Lobby rows, the settings screen and the touch placement editor.
import { ACTIONS, TOUCH_CONTROLS, SIZE_MIN, SIZE_MAX, settings, save, bindKey, resetKeys, resetTouch, keyLabel } from './settings.js';

const $ = (id) => document.getElementById(id);
const chevron = (d) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"/></svg>`;
const LEFT = chevron('M10 3 L5 8 L10 13'), RIGHT = chevron('M6 3 L11 8 L6 13');

// "label  [<] value [>]" row cycling through a list of values.
export function stepperRow(label, values, current, format, onPick, { disabled = false, hint = '' } = {}) {
  const row = document.createElement('div');
  row.className = 'row';
  const i = Math.max(0, values.indexOf(current));
  row.innerHTML = `<span></span><div class="stepper"><button type="button" aria-label="Previous ${label}">${LEFT}</button><output></output><button type="button" aria-label="Next ${label}">${RIGHT}</button></div>`;
  row.querySelector('span').textContent = label;
  if (hint) { const s = document.createElement('small'); s.textContent = hint; row.querySelector('span').append(s); }
  const out = row.querySelector('output');
  const shown = format(values[i]);
  if (shown instanceof Node) out.append(shown); else out.textContent = shown;
  const [prev, next] = row.querySelectorAll('button');
  prev.disabled = next.disabled = disabled;
  prev.onclick = () => onPick(values[(i - 1 + values.length) % values.length]);
  next.onclick = () => onPick(values[(i + 1) % values.length]);
  return row;
}

export function toggleRow(label, on, onPick, { disabled = false, hint = '', onText = 'On', offText = 'Off' } = {}) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = '<span></span><button type="button" class="toggle"></button>';
  row.querySelector('span').textContent = label;
  if (hint) { const s = document.createElement('small'); s.textContent = hint; row.querySelector('span').append(s); }
  const b = row.querySelector('button');
  b.textContent = on ? onText : offText;
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', label);
  b.disabled = disabled;
  b.onclick = () => onPick(!on);
  return row;
}

// ---------------- settings screen ----------------
export function initSettings({ input, audio, onOpen, onClose, openEditor }) {
  const screen = $('screen-settings');
  let listening = null;

  const tabs = screen.querySelectorAll('[role="tab"]');
  for (const t of tabs) {
    t.onclick = () => {
      for (const o of tabs) o.setAttribute('aria-selected', String(o === t));
      for (const p of screen.querySelectorAll('.tab')) p.hidden = p.dataset.panel !== t.dataset.tab;
    };
  }

  function renderKeys() {
    const box = $('bindings');
    box.innerHTML = '';
    const keys = settings().keys;
    for (const [action, name] of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'binding';
      const label = document.createElement('span');
      label.textContent = name;
      row.append(label);
      for (const slot of [0, 1]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'keycap';
        b.dataset.capture = '';
        const isListening = listening && listening.action === action && listening.slot === slot;
        b.textContent = isListening ? 'Press a key…' : keyLabel(keys[action]?.[slot]);
        if (isListening) b.classList.add('listening');
        b.setAttribute('aria-label', `${name}, ${slot ? 'second' : 'main'} key: ${keyLabel(keys[action]?.[slot])}. Change`);
        b.onclick = (e) => {
          if (listening) return;
          e.preventDefault();
          listening = { action, slot };
          input.capture = (code) => {
            input.capture = null;
            const l = listening;
            listening = null;
            if (code !== 'Escape') bindKey(l.action, l.slot, code === 'Backspace' || code === 'Delete' ? '' : code);
            renderKeys();
          };
          renderKeys();
        };
        row.append(b);
      }
      box.append(row);
    }
  }

  function renderTouch() {
    const t = settings().touch;
    const rows = $('touch-rows');
    rows.innerHTML = '';
    const setTouch = (patch) => { save({ touch: { ...settings().touch, ...patch } }); renderTouch(); };
    rows.append(toggleRow('Movement invert', t.moveInvert, (v) => setTouch({ moveInvert: v }), { onText: 'X, Y', offText: 'None', hint: 'Flip the move stick on both axes' }));
    rows.append(toggleRow('Aiming invert', t.aimInvert, (v) => setTouch({ aimInvert: v }), { onText: 'X, Y', offText: 'None', hint: 'Flip the aim stick on both axes' }));
    rows.append(toggleRow('Swap sticks', t.swap, (v) => setTouch({ swap: v, pos: {} }), { hint: 'Aim with your left thumb, move with your right' }));
    const ops = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    rows.append(stepperRow('HUD opacity', ops, nearest(ops, t.opacity), (v) => `${Math.round(v * 100)}%`, (v) => setTouch({ opacity: v })));
    // the aim stick shoots once pushed past this share of its radius; lower = fires sooner
    const fires = [0.7, 0.55, 0.45, 0.35, 0.25, 0.15];
    const fireNames = ['Lowest', 'Low', 'Medium', 'Default', 'High', 'Highest'];
    rows.append(stepperRow('Fire sensitivity', fires, nearest(fires, t.fireAt ?? 0.35), (v) => fireNames[fires.indexOf(v)], (v) => setTouch({ fireAt: v }), { hint: 'How far you push the aim stick before it shoots' }));
  }

  function renderGeneral() {
    const s = settings();
    const rows = $('general-rows');
    rows.innerHTML = '';
    const vols = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    rows.append(stepperRow('Sound volume', vols, nearest(vols, s.volume), (v) => (v === 0 ? 'Muted' : `${Math.round(v * 100)}%`), (v) => { save({ volume: v }); audio.setVolume(v); renderGeneral(); }));
    rows.append(toggleRow('Blood', s.blood, (v) => { save({ blood: v }); renderGeneral(); }));
  }

  $('keys-reset').onclick = () => { resetKeys(); renderKeys(); };
  $('touch-reset').onclick = () => { resetTouch(); renderTouch(); };
  $('touch-edit').onclick = () => { close(true); openEditor(); };
  $('settings-done').onclick = () => close();
  screen.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !listening) close(); });

  function open() {
    renderKeys(); renderTouch(); renderGeneral();
    screen.hidden = false;
    onOpen?.();
    $('settings-done').focus();
  }
  function close(toEditor = false) {
    if (listening) { input.capture = null; listening = null; }
    screen.hidden = true;
    if (!toEditor) onClose?.();
  }
  for (const b of document.querySelectorAll('.open-settings')) b.onclick = open;
  return { open, close, isOpen: () => !screen.hidden };
}

const nearest = (list, v) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

// ---------------- touch placement editor ----------------
export function initEditor({ input, onClose, handleAt }) {
  const el = $('touch-editor');
  let selected = 'fire';
  let drag = null;
  const names = Object.fromEntries(TOUCH_CONTROLS);

  const controls = () => [{ ...input.movePad, id: 'move' }, { ...input.firePad, id: 'fire' }, ...input.buttons.filter((b) => names[b.id])];
  const hit = (x, y) => controls().filter((c) => Math.hypot(x - c.x, y - c.y) < c.r * 1.2).sort((a, b) => a.r - b.r)[0];

  function update() {
    const t = settings().touch;
    $('editor-sel').textContent = `${names[selected]} · Drag to move · Use a corner handle to resize · Tap another control to select it`;
    $('ed-size').textContent = `${(t.size[selected] ?? 1).toFixed(1)}x`;
    $('ed-op').textContent = `${Math.round(t.opacity * 100)}%`;
  }
  const setTouch = (patch) => { save({ touch: { ...settings().touch, ...patch } }); update(); };
  const resize = (d) => {
    const t = settings().touch;
    const v = Math.round(Math.max(SIZE_MIN, Math.min(SIZE_MAX, (t.size[selected] ?? 1) + d)) * 10) / 10;
    setTouch({ size: { ...t.size, [selected]: v } });
  };
  $('ed-size-up').onclick = () => resize(0.1);
  $('ed-size-down').onclick = () => resize(-0.1);
  $('ed-op-up').onclick = () => setTouch({ opacity: Math.min(1, Math.round((settings().touch.opacity + 0.1) * 10) / 10) });
  $('ed-op-down').onclick = () => setTouch({ opacity: Math.max(0.3, Math.round((settings().touch.opacity - 0.1) * 10) / 10) });
  $('ed-default').onclick = () => { resetTouch(); update(); };
  // "Tap to reset a control"
  $('ed-reset-one').onclick = () => {
    const t = settings().touch;
    const pos = { ...t.pos }, size = { ...t.size };
    delete pos[selected]; delete size[selected];
    setTouch({ pos, size });
  };
  $('ed-done').onclick = () => { el.hidden = true; onClose?.(); };

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.editor-bar')) return;
    // a corner handle of the selected control resizes it
    const h = handleAt?.(e.clientX, e.clientY);
    if (h) {
      drag = { id: h.id, resize: true, cx: h.cx, cy: h.cy, base: h.r / (settings().touch.size[h.id] ?? 1), pointer: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      return;
    }
    const c = hit(e.clientX, e.clientY);
    if (!c) return;
    selected = c.id;
    drag = { id: c.id, dx: e.clientX - c.x, dy: e.clientY - c.y, pointer: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    update();
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const t = settings().touch;
    if (drag.resize) {
      const k = Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round((Math.max(Math.abs(e.clientX - drag.cx), Math.abs(e.clientY - drag.cy)) - 6) / drag.base * 10) / 10));
      setTouch({ size: { ...t.size, [drag.id]: k } });
      return;
    }
    const x = Math.max(0, Math.min(innerWidth, e.clientX - drag.dx)), y = Math.max(0, Math.min(innerHeight, e.clientY - drag.dy));
    setTouch({ pos: { ...t.pos, [drag.id]: [x / innerWidth, y / innerHeight] } });
  });
  const end = () => { drag = null; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  return {
    open() { el.hidden = false; update(); },
    isOpen: () => !el.hidden,
    selected: () => selected,
  };
}
