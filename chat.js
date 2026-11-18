/* =====================================================================
   MIRU — chat de preguntas (portada y tienda)
   · Responde solo, con los datos de la carta que publica el gestor (tienda/miru): horarios, zonas de envío,
     formas de pago, promos, precios, retiro, demora y pedido mínimo. No usa IA: reconoce palabras clave.
   · Si no sabe la respuesta, o el cliente quiere hablar con una persona, ofrece WhatsApp con la pregunta escrita.
   · La conversación se guarda mientras dura la visita (sessionStorage), así sigue igual entre la portada y la tienda.
   · Se carga con <script src="/chat.js" defer>. No aparece en las vistas previas del gestor (?vista=1).
   · Se abre desde cualquier botón con el atributo data-chat (encabezado, barra de abajo del celular, tienda).
     Así no queda flotando encima del contenido. Solo si la página no tiene ninguno, se agrega un botón flotante.
   · En computadora se abre debajo del botón que lo abrió; en el celular ocupa toda la pantalla.
   · «¿Llegan a mi zona?»: el cliente escribe su dirección, Google Maps la sugiere y el chat dice si llegamos y cuánto
     sale el envío, con las mismas zonas dibujadas y la misma cuenta que la tienda (zonas del gestor, T.mapsKey).
   ===================================================================== */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).has('vista') || window.__miruChat) return;
  window.__miruChat = true;

  const DOC = 'https://firestore.googleapis.com/v1/projects/gestor-f693d/databases/(default)/documents/tienda/miru';
  const WA_RESPALDO = '5491159076070';
  const HORARIOS_RESPALDO = 'Miércoles y jueves · 19 a 23:30\nViernes a lunes · 12 a 16 y 19 a 23:30\nMartes cerrado';
  const CLAVE = 'miru_chat_v1';
  const PEDIR = '/pedir/';
  const enTienda = /^\/pedir/.test(location.pathname) || /tienda\.html$/.test(location.pathname);
  let T = null;

  const nz = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plata = n => '$' + Math.round(+n || 0).toLocaleString('es-AR');
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // número en formato internacional: «11 6188-5130» → 5491161885130
  const waNum = v => { let n = String(v || '').replace(/\D/g, '').replace(/^0+/, ''); if (/^15\d{8}$/.test(n)) n = '11' + n.slice(2); if (n.length === 10) n = '549' + n; else if (/^54[1-8]\d{9}$/.test(n)) n = '549' + n.slice(2); return n.length >= 12 ? n : ''; };
  const wa = () => waNum(T && T.wa) || WA_RESPALDO;

  fetch(DOC, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j) T = JSON.parse(j.fields.j.stringValue); }).catch(() => {});

  /* ---------------- estilos (sistema MIRU: bordes rectos, Bebas + Barlow, crema y negro) ---------------- */
  const css = `
.mc-btn{position:fixed;right:1.4rem;bottom:var(--mc-abajo,1.4rem);transition:bottom .35s cubic-bezier(.25,.46,.45,.94);z-index:9990;display:flex;align-items:center;gap:.6rem;background:none;border:0;padding:0;cursor:pointer;font-family:'Barlow',system-ui,sans-serif;animation:mcPop .5s cubic-bezier(.2,.9,.3,1.1) 1.2s both}
.mc-btn:hover .mc-redondo{transform:translateY(-2px)}
.mc-etq{background:#f0ead8;color:#0e0c0a;border:1.5px solid #0e0c0a;padding:.55rem .8rem;font-size:.78rem;font-weight:700;box-shadow:0 8px 32px rgba(14,12,10,.10)}
.mc-redondo{width:60px;height:60px;border-radius:50%;background:#0e0c0a;color:#f0ead8;border:2px solid #f0ead8;box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 24px 60px rgba(14,12,10,.28);position:relative;transition:transform .2s}
.mc-punto{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#e8772e;border:2px solid #0e0c0a}
.mc-btn[aria-expanded="true"] .mc-etq,.mc-btn[aria-expanded="true"] .mc-punto{display:none}
.mc-panel{position:fixed;right:1.4rem;top:var(--mc-arriba,90px);z-index:9991;width:min(390px,calc(100vw - 2rem));height:min(600px,calc(100vh - var(--mc-arriba,90px) - 20px));display:flex;flex-direction:column;background:#f0ead8;color:#0e0c0a;border:1px solid #d4c9ae;box-shadow:0 32px 80px rgba(14,12,10,.35);font-family:'Barlow',system-ui,sans-serif;animation:mcAbre .3s cubic-bezier(.25,.46,.45,.94) both}
.mc-panel[hidden]{display:none}
.mc-cab{background:#0e0c0a;color:#f0ead8;padding:.8rem 1rem;display:flex;align-items:center;gap:.8rem}
.mc-avatar{width:42px;height:42px;border-radius:50%;background:#c0392b;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:1.4rem;position:relative;flex:none}
.mc-avatar::after{content:'';position:absolute;right:0;bottom:0;width:11px;height:11px;border-radius:50%;background:#3fbf6a;border:2px solid #0e0c0a}
.mc-cab b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:1.35rem;letter-spacing:1.5px;line-height:1}
.mc-cab small{font-size:.72rem;color:#b08b62}
.mc-cerrar{margin-left:auto;width:44px;height:44px;background:transparent;border:1px solid rgba(240,234,216,.2);color:#f0ead8;font-size:1.1rem;cursor:pointer}
.mc-msgs{flex:1;overflow-y:auto;padding:1rem .9rem;display:flex;flex-direction:column;gap:.6rem;background:#ebe4d0;overscroll-behavior:contain}
.mc-m{max-width:86%;animation:mcMsg .35s cubic-bezier(.25,.46,.45,.94) both}
.mc-bot{align-self:flex-start;display:flex;flex-direction:column;gap:.45rem}
.mc-bot>div{background:#faf8f3;padding:.7rem .85rem;font-size:.92rem;line-height:1.5;white-space:pre-line;box-shadow:0 1px 2px rgba(14,12,10,.08)}
.mc-yo{align-self:flex-end;background:#0e0c0a;color:#f0ead8;padding:.7rem .85rem;font-size:.92rem;line-height:1.5}
.mc-acc{align-self:flex-start;color:#faf8f3 !important;text-decoration:none;font-weight:700;font-size:.72rem;letter-spacing:2px;text-transform:uppercase;padding:.75rem 1rem;display:inline-flex;align-items:center;gap:.5rem;min-height:44px;box-sizing:border-box}
.mc-acc:hover{filter:brightness(1.08)}
.mc-tipeo{align-self:flex-start;background:#faf8f3;padding:.75rem .9rem;display:flex;gap:4px}
.mc-tipeo i{width:6px;height:6px;border-radius:50%;background:#5f574a;animation:mcDot 1.2s infinite}
.mc-tipeo i:nth-child(2){animation-delay:.15s}.mc-tipeo i:nth-child(3){animation-delay:.3s}
.mc-pie{border-top:1px solid #d4c9ae;padding:.6rem .75rem .75rem;display:flex;flex-direction:column;gap:.6rem;background:#f0ead8}
.mc-chips{display:flex;gap:.4rem;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}
.mc-chips button{flex:none;min-height:36px;padding:0 .8rem;background:transparent;border:1.5px solid #0e0c0a;color:#0e0c0a;font-family:inherit;font-weight:600;font-size:.8rem;white-space:nowrap;cursor:pointer;transition:background .2s,color .2s}
.mc-chips button:hover{background:#0e0c0a;color:#f0ead8}
.mc-form{display:flex;gap:.5rem}
.mc-acc.mc-btnacc{border:0;cursor:pointer;font-family:inherit}
.mc-dir{display:flex;flex-direction:column;gap:.35rem}
.mc-dir-cab{display:flex;justify-content:space-between;align-items:center;gap:.5rem;font-size:.72rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5f574a}
.mc-dir-cab button{background:none;border:0;color:#c0392b;font:inherit;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;min-height:32px;padding:0 .2rem}
.mc-sug{display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;width:100%;min-height:44px;padding:.5rem .7rem;background:#faf8f3;border:1px solid #d4c9ae;color:#0e0c0a;font-family:inherit;font-size:.88rem;cursor:pointer;transition:background .15s}
.mc-sug small{font-size:.74rem;color:#5f574a}
.mc-sug:hover,.mc-sug:focus-visible{background:#fff}
.mc-dir-nota{font-size:.8rem;font-style:italic;color:#5f574a;padding:.2rem .1rem}
.mc-panel.mc-modo-dir .mc-chips{display:none}
.mc-form input{flex:1;min-width:0;height:46px;box-sizing:border-box;border:2px solid #0e0c0a;background:#faf8f3;padding:0 .8rem;font-family:inherit;font-size:16px;color:#0e0c0a;border-radius:0}
.mc-form button{width:46px;height:46px;background:#c0392b;color:#faf8f3;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer}
.mc-btn:focus-visible,.mc-panel button:focus-visible,.mc-panel a:focus-visible,.mc-panel input:focus-visible{outline:3px solid #e8772e;outline-offset:2px}
.mc-oculto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes mcPop{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1;transform:none}}
@keyframes mcAbre{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes mcMsg{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes mcDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
@media (max-width:820px){.mc-etq{display:none}.mc-btn{right:1rem}.mc-panel{inset:0;width:auto;height:auto;border:0;animation-name:mcSube}body.mc-abierto{overflow:hidden}}
@keyframes mcSube{from{transform:translateY(100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.mc-btn,.mc-panel,.mc-m,.mc-tipeo i{animation:none}}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------------- interfaz ---------------- */
  const btn = document.createElement('button');
  btn.className = 'mc-btn'; btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'mc-panel');
  btn.innerHTML = `<span class="mc-etq">¿Dudas? Preguntanos</span><span class="mc-redondo"><span class="mc-oculto">Abrir el chat de preguntas</span>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5.1A8.4 8.4 0 1 1 21 11.5z"></path><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"></path></svg>
    <span class="mc-punto" aria-hidden="true"></span></span>`;
  const panel = document.createElement('section');
  panel.className = 'mc-panel'; panel.id = 'mc-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat de preguntas de MIRU');
  panel.innerHTML = `<div class="mc-cab"><div class="mc-avatar" aria-hidden="true">M</div><div><b>MIRU</b><small>Respuestas al instante · o hablá con nosotros</small></div>
      <button class="mc-cerrar" type="button" aria-label="Cerrar el chat">✕</button></div>
    <div class="mc-msgs" aria-live="polite"></div>
    <div class="mc-pie"><div class="mc-dir" hidden></div><div class="mc-chips"></div>
      <form class="mc-form"><label class="mc-oculto" for="mc-texto">Escribí tu pregunta</label><input id="mc-texto" autocomplete="off" maxlength="200" placeholder="Escribí tu pregunta…">
        <button type="submit" aria-label="Enviar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button></form></div>`;
  document.body.append(panel);
  // ¿La página tiene sus propios botones para abrir el chat? Entonces no hace falta el flotante
  const hayDisparadores = () => !!document.querySelector('[data-chat]');
  if (!hayDisparadores()) {
    btn.setAttribute('data-chat', ''); document.body.append(btn); if (enTienda) btn.style.bottom = '6.6rem';
    // páginas que dibujan sus botones después (la tienda): cuando aparece uno propio, el flotante se va
    const mo = new MutationObserver(() => { if (document.querySelector('[data-chat]:not(.mc-btn)')) { btn.remove(); mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  const msgs = panel.querySelector('.mc-msgs'), input = panel.querySelector('input'), chips = panel.querySelector('.mc-chips'), dirBox = panel.querySelector('.mc-dir');

  const OPCIONES = ['¿Qué horarios tienen?', '¿Llegan a mi zona?', '¿Cómo pago?', 'Promos', '¿Cuánto sale una pizza?', 'Hablar con una persona'];
  chips.innerHTML = OPCIONES.map(o => `<button type="button">${esc(o)}</button>`).join('');

  let hist = [];
  try { hist = JSON.parse(sessionStorage.getItem(CLAVE) || '[]'); } catch (e) {}
  const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify(hist.slice(-40))); } catch (e) {} };
  function pintar(m, nuevo) {
    const el = document.createElement('div');
    if (m.yo) { el.className = 'mc-m mc-yo'; el.textContent = m.t; }
    else {
      el.className = 'mc-m mc-bot';
      el.innerHTML = `<div>${esc(m.t)}</div>${m.link ? (m.link.accion
        ? `<button type="button" class="mc-acc mc-btnacc" data-mc="${esc(m.link.accion)}" style="background:${m.link.bg}">${esc(m.link.label)}</button>`
        : `<a class="mc-acc" href="${esc(m.link.href)}" ${m.link.ext ? 'target="_blank" rel="noopener"' : ''} style="background:${m.link.bg}">${esc(m.link.label)}</a>`) : ''}`;
    }
    if (!nuevo) el.style.animation = 'none';
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight;
  }
  function bienvenida() {
    if (hist.length) return;
    hist.push({ t: '¡Hola! Soy el asistente de MIRU 🍕\nPreguntame horarios, envíos, precios o formas de pago. Si preferís, te paso con nosotros por WhatsApp.' });
    guardar();
  }

  /* ---------------- respuestas ---------------- */
  const linkWa = q => ({ label: '💬 Hablar por WhatsApp', bg: '#1f8a4c', ext: true, href: 'https://wa.me/' + wa() + '?text=' + encodeURIComponent('Hola MIRU, tengo una consulta: ' + q) });
  const linkPedir = (id, label) => ({ label: label || 'Ir a pedir →', bg: '#c0392b', href: PEDIR + (id != null ? '?plato=' + encodeURIComponent(id) : '') });
  const NO = new Set(['pizza', 'pizzas', 'de', 'del', 'y', 'con', 'la', 'el', 'a', 'al', 'en', 'los', 'las', 'un', 'una', 'x']);
  const claves = t => nz(t).replace(/cuatro/g, '4').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w && !NO.has(w)).map(w => w.length > 4 ? w.replace(/(es|s)$/, '') : w);
  const items = () => (T && Array.isArray(T.cats) ? T.cats : []).flatMap(c => (c.items || []).map(it => ({ ...it, cat: c.n })));
  function buscarPlato(q) {
    const Q = new Set(claves(q)); if (!Q.size) return null;
    let mejor = null, pm = 0;
    items().forEach(it => {
      const K = claves(it.n); if (!K.length) return;
      const c = K.filter(w => Q.has(w)).length; if (!c) return;
      const v = c / K.length + c * .01; // todas las palabras del plato pesan más; a igualdad, el nombre más largo
      if (v > pm) { pm = v; mejor = it; }
    });
    return pm >= .5 ? mejor : null;
  }
  const deCat = re => items().filter(it => re.test(nz(it.cat)));
  function zonasTxt() {
    const z = (T && T.zonas) || [];
    if (!z.length) return '';
    // Los nombres de las zonas son internos (Zona 1, 2…): al cliente solo se le dice el rango de costos
    const costos = z.map(x => Math.max(0, +x.costo || 0)), min = Math.min(...costos), max = Math.max(...costos), porKm = z.some(x => +x.km > 0);
    const gratis = min === 0 ? 'Las zonas más cercanas no tienen costo de envío. ' : '';
    if (porKm) return gratis + 'Para las más lejanas, el envío depende de la distancia.';
    if (max === min) return min === 0 ? 'El envío no tiene costo.' : 'El envío cuesta ' + plata(min) + '.';
    return gratis + 'Según la distancia, el envío va de ' + plata(min) + ' a ' + plata(max) + '.';
  }
  /* ---------------- ¿llegamos a tu dirección? (Google Maps + zonas dibujadas en el gestor) ---------------- */
  const zonasM = () => ((T && T.zonas) || []).filter(z => Array.isArray(z.poly) && z.poly.length > 2);
  const conMapa = () => !!(T && T.mapsKey && zonasM().length);
  function enPoly(lat, lng, poly) {
    let d = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      if ((xi > lng) !== (xj > lng) && lat < (yj - yi) * (lng - xi) / (xj - xi) + yi) d = !d;
    }
    return d;
  }
  const kmEntre = (a, b, c, d) => { const R = 6371, rr = x => x * Math.PI / 180, h = Math.sin(rr(c - a) / 2) ** 2 + Math.cos(rr(a)) * Math.cos(rr(c)) * Math.sin(rr(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const envioZ = (z, lat, lng) => Math.round(((+z.costo || 0) + (+z.km || 0) * (T.local ? kmEntre(T.local.lat, T.local.lng, lat, lng) : 0)) / 50) * 50; // igual que la tienda
  let GM = null, mapsMal = false, sesion = null, sugs = [], sugN = 0, sugH = 0, modoDir = false;
  function cargarMaps() { // Google Maps se carga solo cuando alguien consulta su dirección
    if (GM) return GM;
    if (window.google && google.maps && google.maps.importLibrary) return (GM = google.maps.importLibrary('places')); // la tienda ya lo cargó
    GM = new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error('tiempo')), 15000);
      const antes = window.gm_authFailure; window.gm_authFailure = () => { mapsMal = true; if (typeof antes === 'function') antes(); };
      window.__mcGmOk = () => { clearTimeout(t); ok(); };
      const sc = document.createElement('script'); sc.async = true; sc.onerror = () => { clearTimeout(t); no(new Error('red')); };
      sc.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(T.mapsKey) + '&loading=async&language=es&region=AR&v=weekly&callback=__mcGmOk';
      document.head.appendChild(sc);
    }).then(() => google.maps.importLibrary('places'));
    GM.catch(() => { GM = null; });
    return GM;
  }
  async function buscarDir(txt) {
    const P = await cargarMaps(); sesion = sesion || new P.AutocompleteSessionToken();
    const L = T.local, r = await P.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: txt.trim(), sessionToken: sesion, includedRegionCodes: ['ar'], language: 'es', region: 'ar', ...(L ? { locationBias: { center: { lat: L.lat, lng: L.lng }, radius: 20000 } } : {}) });
    return (r.suggestions || []).filter(x => x.placePrediction).slice(0, 4);
  }
  function pintarDir(nota) {
    dirBox.hidden = !modoDir; panel.classList.toggle('mc-modo-dir', modoDir);
    if (!modoDir) { dirBox.innerHTML = ''; return; }
    dirBox.innerHTML = `<div class="mc-dir-cab"><span>Tu dirección</span><button type="button" data-mc="dir-salir">Cancelar</button></div>` +
      (sugs.length ? sugs.map((x, i) => { const pp = x.placePrediction, a = pp.mainText ? pp.mainText.text : pp.text.text, b = pp.secondaryText ? pp.secondaryText.text.replace(/,\s*Argentina$/i, '') : ''; return `<button type="button" class="mc-sug" data-sug="${i}">${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}</button>`; }).join('')
        : `<div class="mc-dir-nota">${esc(nota || 'Escribí calle y número, por ejemplo: Laprida 1234, Lomas de Zamora')}</div>`);
  }
  function entrarDir() {
    modoDir = true; sugs = []; input.value = ''; input.placeholder = 'Calle y número…'; input.setAttribute('autocomplete', 'street-address');
    pintarDir(); input.focus({ preventScroll: true });
  }
  function salirDir() { modoDir = false; sugs = []; sesion = null; input.placeholder = 'Escribí tu pregunta…'; input.setAttribute('autocomplete', 'off'); pintarDir(); }
  function sugerirDir(txt) {
    const n = ++sugN;
    if (txt.trim().length < 4) { sugs = []; pintarDir(); return; }
    pintarDir('Buscando…');
    buscarDir(txt).then(l => { if (n === sugN && modoDir) { sugs = l; pintarDir(l.length ? '' : 'No encontramos esa dirección. Revisá cómo está escrita.'); } })
      .catch(() => { if (n === sugN && modoDir) { sugs = []; pintarDir('No pudimos buscar direcciones ahora. Probá de nuevo en un momento.'); } });
  }
  function decir(r) { hist.push(r); guardar(); pintar(r, true); }
  async function verificar(sug) {
    const texto = sug.placePrediction.text.text.replace(/,\s*Argentina$/i, '');
    const yo = { yo: true, t: texto }; hist.push(yo); guardar(); pintar(yo, true);
    salirDir();
    const tip = document.createElement('div'); tip.className = 'mc-tipeo'; tip.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(tip); msgs.scrollTop = msgs.scrollHeight;
    let r;
    try {
      const pl = sug.placePrediction.toPlace();
      await pl.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents'] });
      sesion = null;
      if (!pl.location) throw new Error('sin-ubicacion');
      const lat = pl.location.lat(), lng = pl.location.lng();
      const conNum = (pl.addressComponents || []).some(c => (c.types || []).includes('street_number'));
      const dir = String(pl.formattedAddress || texto).replace(/,\s*Argentina$/i, '');
      const z = zonasM().find(zz => enPoly(lat, lng, zz.poly));
      if (!conNum) { r = { t: 'Me falta la altura de la calle para saber exactamente dónde es. Escribila con el número, por ejemplo: Laprida 1234.', link: { accion: 'dir', label: 'Probar otra vez →', bg: '#0e0c0a' } }; }
      else if (z) { const env = envioZ(z, lat, lng); r = { t: '✓ Sí, llegamos a ' + dir + '.\n' + (env ? 'El envío cuesta ' + plata(env) + '.' : 'El envío es sin cargo.') + (T && +T.minimo ? '\nPedido mínimo: ' + plata(T.minimo) + '.' : ''), link: linkPedir(null, 'Hacer mi pedido →') }; }
      else r = { t: 'Por ahora no hacemos delivery a ' + dir + '.\nPodés retirar tu pedido' + (T && T.dirLocal ? ' en ' + T.dirLocal : ' en el local') + ', o escribinos y vemos cómo ayudarte.', link: linkWa('Quería saber si pueden hacer delivery a ' + dir) };
      if (typeof gtag === 'function') gtag('event', 'chat_direccion', { resultado: !conNum ? 'sin_numero' : z ? 'llega' : 'fuera' });
    } catch (e) {
      r = { t: 'No pude verificar la dirección en este momento. En la tienda la podés probar al pedir, o escribinos.', link: linkWa('Quería saber si llegan a ' + texto) };
    }
    tip.remove(); decir(r);
  }

  function responder(q) {
    const n = nz(q);
    if (/persona|humano|whatsapp|hablar|asesor|atencion|llamar|telefono/.test(n)) return { t: 'Dale, te paso con nosotros. Tocá el botón y se abre WhatsApp con tu consulta.', link: linkWa(q) };
    if (/promo|oferta|descuento|combo/.test(n)) {
      const p = deCat(/promo/);
      return p.length ? { t: 'Promos de hoy:\n' + p.map(x => '• ' + x.n + ': ' + plata(x.p)).join('\n'), link: linkPedir(p[0].id, 'Pedir la promo →') } : { t: 'Hoy no tenemos promos cargadas, pero mirá la carta: siempre hay algo rico.', link: linkPedir() };
    }
    const plato = /precio|cuanto|sale|vale|cuesta|tienen|hay|quiero/.test(n) || claves(q).length <= 4 ? buscarPlato(q) : null;
    if (plato) {
      const salsa = Array.isArray(plato.o) && plato.o.length;
      return { t: plato.n + ': ' + plata(plato.p) + (salsa ? '\nAl pedir le podés sumar un adicional: ' + plato.o.slice(0, 4).map(o => o.n + ' (+' + plata(o.p) + ')').join(', ') + (plato.o.length > 4 ? '…' : '') + '.' : '') + '\n¿Lo pedís?', link: linkPedir(plato.id, 'Pedir ' + plato.n + ' →') };
    }
    if (/horario|abren|abierto|abre|cierran|cierra|hora|dias|cuando|hoy/.test(n)) return { t: 'Nuestros horarios:\n' + ((T && String(T.horarios || '').trim()) || HORARIOS_RESPALDO).split('\n').map(l => '• ' + l.replace(/^[•\-\s]+/, '')).join('\n') + (T && T.activa === false ? '\n\nAhora la tienda online está pausada: escribinos por WhatsApp.' : '') };
    if (/envio|delivery|zona|llevan|llegan|reparto|domicilio|barrio|banfield|lanus|temperley|lomas|adrogue|turdera|avellaneda/.test(n)) {
      const zt = zonasTxt();
      if (conMapa()) return { t: 'Hacemos delivery en Lomas de Zamora y alrededores.' + (zt ? '\n' + zt : '') + '\nDecime tu dirección y te digo al toque si llegamos y cuánto sale el envío.', link: { accion: 'dir', label: 'Consultar mi dirección →', bg: '#c0392b' } };
      return { t: 'Hacemos delivery en Lomas de Zamora y alrededores.' + (zt ? '\n' + zt : '') + '\nEn la tienda elegís tu zona y ves el costo del envío.' + (T && +T.minimo ? '\nPedido mínimo: ' + plata(T.minimo) + '.' : ''), link: linkPedir(null, 'Ir a la tienda →') };
    }
    if (/pago|pagar|pagan|mercado|transfer|efectivo|tarjeta|alias|cuotas|debito|credito/.test(n)) {
      const l = [];
      if (T && T.mp) l.push('• Mercado Pago (' + (T.mpCred === false ? 'débito o dinero en cuenta' : 'tarjeta, débito o dinero en cuenta') + ')');
      l.push('• Transferencia', '• Efectivo al recibir');
      return { t: 'Podés pagar con:\n' + l.join('\n') };
    }
    if (/precio|cuanto|sale|vale|cuesta|carta|menu|pizza|pasta/.test(n)) {
      const pz = deCat(/pizza/).map(x => +x.p).filter(Boolean), pa = deCat(/pasta/).filter(x => !/congelad/.test(nz(x.cat))).map(x => +x.p).filter(Boolean);
      return { t: (pz.length ? 'Pizzas desde ' + plata(Math.min(...pz)) : '') + (pz.length && pa.length ? ' y pastas desde ' + plata(Math.min(...pa)) : pa.length ? 'Pastas desde ' + plata(Math.min(...pa)) : '') + (pz.length || pa.length ? '.\n' : '') + 'Decime cuál te interesa (por ejemplo «margarita» o «ñoquis») o mirá la carta completa.', link: linkPedir(null, 'Ver la carta →') };
    }
    if (/retir|buscar|direccion|donde|local|ubicacion/.test(n)) return { t: 'Podés retirar tu pedido' + (T && T.dirLocal ? ' en ' + T.dirLocal + '.' : '. Somos un emprendimiento casero en Lomas de Zamora: al elegir «Retiro» en la tienda te mostramos la dirección.') };
    if (/congel|cocinar|casa|fresca|crud/.test(n)) {
      const nombres = T && T.casa ? (T.casa.on ? T.casa.cats || [] : []) : [];
      const c = items().filter(it => nombres.includes(it.cat));
      return c.length ? { t: 'Para cocinar en casa tenemos:\n' + c.slice(0, 8).map(x => '• ' + x.n + ': ' + plata(x.p)).join('\n'), link: linkPedir() } : { t: 'Por ahora no hay productos para cocinar en casa. Si querés saber cuándo vuelven, escribinos.', link: linkWa(q) };
    }
    if (/demora|tarda|tiempo|minutos|rapido/.test(n)) return { t: (T && T.tiempo ? 'La demora estimada es de ' + T.tiempo + '.' : 'Depende del momento.') + ' Después de pedir seguís el estado desde el celular: recibido, en preparación, en camino.' };
    if (/minimo/.test(n)) return { t: T && +T.minimo ? 'El pedido mínimo es de ' + plata(T.minimo) + '.' : 'No tenemos pedido mínimo.' };
    if (/sin tacc|celiac|vegan|vegetarian|alerg/.test(n)) return { t: 'Para alergias o dietas especiales preferimos hablarlo directamente, así te contamos bien qué lleva cada plato.', link: linkWa(q) };
    if (/hola|buenas|buen dia|que tal/.test(n)) return { t: '¡Hola! ¿En qué te ayudo? Podés tocar una de las opciones de abajo.' };
    if (/gracias|genial|perfecto|dale|ok/.test(n)) return { t: '¡De nada! Cualquier otra cosa, acá estoy 🙌' };
    return { t: 'Mmm, esa no la sé responder. ¿Querés preguntarla directamente a nosotros?', link: linkWa(q) };
  }

  let tReloj = 0;
  function preguntar(q) {
    q = String(q || '').trim().slice(0, 200); if (!q) return;
    const yo = { yo: true, t: q }; hist.push(yo); guardar(); pintar(yo, true);
    input.value = '';
    const tip = document.createElement('div'); tip.className = 'mc-tipeo'; tip.setAttribute('aria-label', 'MIRU está escribiendo'); tip.innerHTML = '<i></i><i></i><i></i>';
    msgs.appendChild(tip); msgs.scrollTop = msgs.scrollHeight;
    clearTimeout(tReloj);
    tReloj = setTimeout(() => { tip.remove(); const r = responder(q); hist.push(r); guardar(); pintar(r, true); if (typeof gtag === 'function') gtag('event', 'chat_pregunta', { respuesta: r.link && r.link.ext ? 'whatsapp' : 'auto' }); }, 650);
  }

  let origen = null;
  function abrir(si, desde) {
    if (si && desde) {
      origen = desde;
      const r = desde.getBoundingClientRect();
      // debajo del botón si está arriba de la pantalla; si está abajo (botón flotante), por encima
      const arriba = r.top < innerHeight / 2 ? r.bottom + 10 : Math.max(16, r.top - 610);
      document.documentElement.style.setProperty('--mc-arriba', Math.round(arriba) + 'px');
    }
    panel.hidden = !si;
    document.body.classList.toggle('mc-abierto', si);
    document.querySelectorAll('[data-chat]').forEach(b => { b.setAttribute('aria-expanded', String(si)); b.setAttribute('aria-controls', 'mc-panel'); });
    if (si) { if (!msgs.childElementCount) { bienvenida(); hist.forEach(m => pintar(m, false)); } msgs.scrollTop = msgs.scrollHeight; if (innerWidth > 820) setTimeout(() => input.focus({ preventScroll: true }), 50); }
    else if (origen && document.contains(origen)) origen.focus();
  }
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-chat]');
    if (d) { e.preventDefault(); abrir(panel.hidden, d); return; }
    // clic afuera del panel (en computadora) lo cierra
    if (!panel.hidden && innerWidth > 820 && !e.target.closest('.mc-panel')) abrir(false);
  });
  panel.querySelector('.mc-cerrar').addEventListener('click', () => abrir(false));
  panel.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!modoDir) { preguntar(input.value); return; }
    if (sugs.length) { verificar(sugs[0]); return; } // Enter: la primera sugerencia
    const txt = input.value; if (txt.trim().length < 4) return;
    clearTimeout(sugH); pintarDir('Buscando…');
    buscarDir(txt).then(l => { if (!modoDir) return; if (l.length) verificar(l[0]); else { sugs = []; pintarDir('No encontramos esa dirección. Revisá cómo está escrita.'); } })
      .catch(() => { if (modoDir) pintarDir('No pudimos buscar direcciones ahora. Probá de nuevo en un momento.'); });
  });
  input.addEventListener('input', () => { if (modoDir) { clearTimeout(sugH); sugH = setTimeout(() => sugerirDir(input.value), 280); } });
  panel.addEventListener('click', e => {
    const a = e.target.closest('[data-mc]'), sg = e.target.closest('[data-sug]');
    if (sg && sugs[+sg.dataset.sug]) { verificar(sugs[+sg.dataset.sug]); return; }
    if (!a) return;
    if (a.dataset.mc === 'dir-salir') { salirDir(); input.focus({ preventScroll: true }); return; }
    if (a.dataset.mc === 'dir') {
      if (!conMapa()) { decir({ t: 'En la tienda escribís tu dirección al pedir y te mostramos el costo del envío.', link: linkPedir() }); return; }
      decir({ t: 'Escribí tu calle y número y elegí tu dirección de la lista 👇' }); entrarDir();
    }
  });
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) preguntar(b.textContent); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) abrir(false); });
  window.MiruChat = { abrir: () => abrir(true, document.querySelector('[data-chat]')), responder, consultarDireccion: () => { abrir(true, document.querySelector('[data-chat]')); entrarDir(); } };
})();
