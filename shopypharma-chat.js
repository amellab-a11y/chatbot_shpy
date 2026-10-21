(function () {
  'use strict';
  if (window.__shopyChatLoaded) return;
  window.__shopyChatLoaded = true;

  var CFG = Object.assign({
    webhookUrl: 'https://vps-4af99332.vps.ovh.net/webhook/e0d71c1d-0768-46fa-9932-3bb84016fa21/chat',
    title: 'Shopypharma',
    subtitle: 'Assistant en ligne',
    color: '#0f766e',
    placeholder: 'Écrivez votre message…',
    startMessage: 'menu',      // message envoyé en silence à l'ouverture (affiche l'accueil du bot)
    openOnLoad: false,
    returnWindowMinutes: 60,   // un visiteur vu dans cette durée n'est pas ré-accueilli
    debug: false,             // true = affiche la cause technique d'une erreur dans le chat
    minDelay: 700,             // pause minimale avant une bulle (ms)
    perChar: 14,               // + ms par caractère
    maxDelay: 3500             // pause maximale avant une bulle (ms)
  }, window.SHOPY_CHAT || {});

  // ---------- Découpage de la réponse en 2-3 messages ----------
  function splitReply(out) {
    out = String(out || '').trim();
    var blocks = out.split(/\n\n+/).filter(Boolean);
    var isMenu = function (b) {
      return b.charAt(0) === '_' ||
        (b.split('\n').every(function (l) { return l.indexOf('- ') === 0; }) && !/TTC|http/.test(b));
    };
    var m = blocks.length;
    while (m > 1 && isMenu(blocks[m - 1])) m--;
    var body = blocks.slice(0, m);
    var menu = blocks.slice(m).join('\n\n');
    var parts = [];
    if (body.length >= 2) { parts.push(body[0]); parts.push(body.slice(1).join('\n\n')); }
    else if (body.length === 1) { parts.push(body[0]); }
    if (menu) parts.push(menu);
    return parts.length ? parts : [out];
  }

  // ---------- Mise en forme (mini markdown) ----------
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:)])/g, '$1<em>$2</em>');
    return s;
  }
  function fillBubble(el, text) {
    el.innerHTML = '';
    var lines = String(text).split('\n');
    var chips = document.createElement('div');
    chips.className = 'spc-chips';
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      if (t.indexOf('- ') === 0) {
        var label = t.slice(2);
        if (/http|TTC/.test(label)) {            // ligne produit : liste normale
          var d = document.createElement('div');
          d.className = 'spc-li';
          d.innerHTML = inline(label);
          el.appendChild(d);
        } else {                                  // choix du menu : bouton cliquable
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'spc-chip';
          b.textContent = label;
          b.addEventListener('click', function () { send(label); });
          chips.appendChild(b);
        }
      } else {
        var p = document.createElement('div');
        p.className = 'spc-p';
        p.innerHTML = inline(t);
        el.appendChild(p);
      }
    });
    if (chips.childNodes.length) el.appendChild(chips);
  }

  // ---------- Interface ----------
  var css = '' +
    '.spc-btn{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:' + CFG.color + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:99998;display:flex;align-items:center;justify-content:center}' +
    '.spc-btn svg{width:28px;height:28px;fill:#fff}' +
    '.spc-win{position:fixed;right:20px;bottom:92px;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100vh - 120px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:99999;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;color:#1f2937}' +
    '.spc-win.open{display:flex}' +
    '.spc-head{background:' + CFG.color + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}' +
    '.spc-head b{display:block;font-size:16px}.spc-head span{font-size:12px;opacity:.85}' +
    '.spc-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}' +
    '.spc-msgs{flex:1;overflow-y:auto;padding:14px;background:#f3f4f6;display:flex;flex-direction:column;gap:8px}' +
    '.spc-m{max-width:85%;padding:9px 12px;border-radius:14px;line-height:1.4;word-wrap:break-word;animation:spcIn .2s ease}' +
    '.spc-bot{background:#fff;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
    '.spc-me{background:' + CFG.color + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.spc-p{margin:2px 0}.spc-li{margin:4px 0}' +
    '.spc-bot a{color:' + CFG.color + ';font-weight:600}' +
    '.spc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.spc-chip{border:1px solid ' + CFG.color + ';background:#fff;color:' + CFG.color + ';border-radius:16px;padding:5px 11px;font-size:13px;cursor:pointer}' +
    '.spc-chip:hover{background:' + CFG.color + ';color:#fff}' +
    '.spc-typing{display:flex;gap:4px;padding:12px 14px}' +
    '.spc-typing i{width:7px;height:7px;border-radius:50%;background:#9ca3af;display:block;animation:spcDot 1.2s infinite ease-in-out}' +
    '.spc-typing i:nth-child(2){animation-delay:.2s}.spc-typing i:nth-child(3){animation-delay:.4s}' +
    '.spc-foot{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}' +
    '.spc-foot input{flex:1;border:1px solid #d1d5db;border-radius:20px;padding:9px 14px;font-size:14px;outline:none}' +
    '.spc-foot input:focus{border-color:' + CFG.color + '}' +
    '.spc-foot button{border:0;background:' + CFG.color + ';color:#fff;border-radius:20px;padding:0 16px;cursor:pointer;font-size:14px}' +
    '.spc-foot button:disabled{opacity:.5;cursor:default}' +
    '@keyframes spcDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}' +
    '@keyframes spcIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'spc-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Ouvrir le chat');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>';

  var win = document.createElement('div');
  win.className = 'spc-win';
  win.innerHTML =
    '<div class="spc-head"><div><b>' + esc(CFG.title) + '</b><span>' + esc(CFG.subtitle) + '</span></div>' +
    '<button class="spc-x" type="button" aria-label="Fermer">&times;</button></div>' +
    '<div class="spc-msgs"></div>' +
    '<form class="spc-foot"><input type="text" maxlength="300" autocomplete="off" placeholder="' + esc(CFG.placeholder) + '">' +
    '<button type="submit">Envoyer</button></form>';

  document.body.appendChild(btn);
  document.body.appendChild(win);

  var msgs = win.querySelector('.spc-msgs');
  var form = win.querySelector('form');
  var input = form.querySelector('input');
  var sendBtn = form.querySelector('button');
  var started = false, busy = false;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // Reconnaissance de l'internaute : identifiant conservé sur son appareil
  var sessionId = lsGet('spc_vid');
  if (!sessionId) {
    sessionId = 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    lsSet('spc_vid', sessionId);
  }

  // "Déjà accueilli" : dernière activité il y a moins de returnWindowMinutes (60 min par défaut)
  var WINDOW_MS = CFG.returnWindowMinutes * 60000;
  function lastSeen() { return parseInt(lsGet('spc_last') || '0', 10) || 0; }
  function touch() { lsSet('spc_last', String(Date.now())); }
  function known() { var l = lastSeen(); return l > 0 && (Date.now() - l) < WINDOW_MS; }

  // Historique de la conversation, restauré si l'internaute revient dans l'heure
  var chatLog = [];
  try { chatLog = JSON.parse(lsGet('spc_hist') || '[]'); } catch (e) { chatLog = []; }
  if (!known()) { chatLog = []; lsDel('spc_hist'); }
  function remember(who, text) {
    chatLog.push({ w: who, t: text });
    if (chatLog.length > 40) chatLog = chatLog.slice(-40);
    lsSet('spc_hist', JSON.stringify(chatLog));
  }

  function scroll() { msgs.scrollTop = msgs.scrollHeight; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function addMe(text, noSave) {
    var d = document.createElement('div');
    d.className = 'spc-m spc-me';
    d.textContent = text;
    msgs.appendChild(d);
    scroll();
    if (!noSave) remember('me', text);
  }
  function addBot(text, noSave) {
    var d = document.createElement('div');
    d.className = 'spc-m spc-bot';
    fillBubble(d, text);
    msgs.appendChild(d);
    scroll();
    if (!noSave) remember('bot', text);
  }
  function showTyping() {
    var d = document.createElement('div');
    d.className = 'spc-m spc-bot spc-typing';
    d.innerHTML = '<i></i><i></i><i></i>';
    msgs.appendChild(d);
    scroll();
    return d;
  }

  async function ask(text, returning) {
    // Le préfixe "[r] " indique au bot que l'internaute a déjà été accueilli dans l'heure
    var res = await fetch(CFG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId: sessionId, chatInput: (returning ? '[r] ' : '') + text })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (Array.isArray(data)) data = data[0] || {};
    return data.output || data.text || data.message || '';
  }

  async function send(text, silent) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    if (!silent) addMe(text);
    var typing = showTyping();
    var t0 = Date.now();
    var returning = known();     // déjà accueilli dans l'heure ?
    touch();
    try {
      var reply = await ask(text, returning);
      var parts = splitReply(reply || 'Désolé, je n\'ai pas compris.');
      for (var i = 0; i < parts.length; i++) {
        var wait = Math.min(CFG.maxDelay, CFG.minDelay + parts[i].length * CFG.perChar);
        if (i === 0) wait -= (Date.now() - t0);       // le temps d'attente du serveur compte déjà
        if (wait > 0) await sleep(wait);
        typing.remove();
        addBot(parts[i]);
        if (i < parts.length - 1) typing = showTyping();
      }
    } catch (e) {
      typing.remove();
      if (window.console) console.error('[Shopypharma chat]', e);
      addBot('Désolé, un problème de connexion est survenu. Réessayez dans un instant.' +
        (CFG.debug ? '\n\n_Détail technique : ' + (e && e.message ? e.message : e) + '_' : ''));
    }
    busy = false; sendBtn.disabled = false;
    input.focus();
  }
  window.__shopyChatSend = send;

  function open() {
    win.classList.add('open');
    if (!started) {
      started = true;
      if (!CFG.webhookUrl) {
        addBot('Le chat n\'est pas configuré (webhookUrl manquant).', true);
      } else if (chatLog.length) {
        // visiteur revenu dans l'heure : on remet la conversation, sans nouvel accueil
        chatLog.forEach(function (m) { m.w === 'me' ? addMe(m.t, true) : addBot(m.t, true); });
      } else {
        send(CFG.startMessage, true);
      }
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { win.classList.remove('open'); }

  btn.addEventListener('click', function () { win.classList.contains('open') ? close() : open(); });
  win.querySelector('.spc-x').addEventListener('click', close);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    input.value = '';
    send(v);
  });

  if (CFG.openOnLoad) open();
})();
