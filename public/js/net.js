// One WebSocket to the room server, with automatic resume: the room code and seat token are kept in
// sessionStorage, so a dropped Wi-Fi link or a page refresh puts you back in your own seat.
const KEY = 'catacombs.session';

export class Net {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus; // 'connected' | 'reconnecting' | 'disconnected' | 'closed'
    this.ws = null;
    this.session = load();
    this.retries = 0;
    this.wanted = false; // are we supposed to be in a room?
  }

  url() { return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; }

  open(first) {
    clearTimeout(this.retryTimer);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(first));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'joined') {
        this.session = { code: m.code, token: m.token };
        save(this.session);
        this.wanted = true;
        this.retries = 0;
        this.onStatus('connected');
      }
      if (m.t === 'kicked' || m.t === 'cancelled') this.forget();
      if (m.t === 'error' && first.t === 'resume') { this.forget(); }
      this.onMessage(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.wanted || !this.session) { this.onStatus('closed'); return; }
      this.reconnect();
    };
  }

  create(profile) { this.open({ t: 'create', name: profile.name, avatar: profile.avatar, token: this.session?.token }); }
  join(code, profile) { this.open({ t: 'join', code, name: profile.name, avatar: profile.avatar, token: this.session?.token }); }

  // Try to get back into the room we were in (after a drop or a refresh).
  resume() {
    if (!this.session) return false;
    this.open({ t: 'resume', code: this.session.code, token: this.session.token });
    return true;
  }

  reconnect() {
    this.onStatus('reconnecting');
    if (this.retries++ >= 12) { this.onStatus('disconnected'); return; }
    this.retryTimer = setTimeout(() => this.resume(), Math.min(2500, 400 + this.retries * 250));
  }

  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  leave() {
    this.send({ t: 'leave' });
    this.forget();
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
  }

  forget() {
    this.wanted = false;
    this.session = null;
    try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
  }
}

function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } }
function save(s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
