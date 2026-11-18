/* =====================================================================
   tiendamiru.com — portada
   Todo sale del gestor (proyecto gestor-f693d), de la carta que publica la app de Gestión en tienda/miru:
   · platos y precios (Carta y costos), WhatsApp e Instagram (Tienda online → General)
   · portada, fotos y videos de la web e imágenes de secciones (Tienda online → Página web)
   · qué secciones van en «Compra aquí para cocinar en casa» y si se muestra
   Los pedidos se hacen en la tienda online: /pedir/ (con Mercado Pago, transferencia o efectivo).
   Reemplaza a app.js y al panel viejo /admin.
   ===================================================================== */
'use strict';

const PEDIR_URL = '/pedir/';
const DOC = 'https://firestore.googleapis.com/v1/projects/gestor-f693d/databases/(default)/documents/tienda/miru';

let T = null;                       // carta publicada
let comidaLista = [];               // platos de Comida Lista
let comidaCategoriaActiva = 'pizzas';
let SECCIONES = [];                 // secciones de «cocinar en casa»
let productos = [];                 // productos de «cocinar en casa»
const FOTOS = new Map();            // id de plato -> foto de la tienda (data URL), se bajan cuando hacen falta

// ===== utilidades =====
function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }
function sanitizeURL(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image/')) return url;
  try { const u = new URL(url); return u.protocol === 'https:' ? url : ''; } catch (e) { return ''; }
}
const plata = n => '$' + Math.round(+n || 0).toLocaleString('es-AR');
const nz = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('visible'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('visible'), 2600); }

// ===== carga de la carta =====
async function cargar() {
  try {
    const r = await fetch(DOC, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    T = JSON.parse((await r.json()).fields.j.stringValue);
  } catch (e) {
    console.error('No se pudo leer la carta del gestor:', e);
    if (!T) { armarComidaLista(); armarCasa(); }
    return;
  }
  const w = T.web || {};
  if (w.hero) aplicarHero(w.hero.tipo, w.hero.url);
  aplicarContacto();
  armarComidaLista();
  armarCasa();
}

function aplicarHero(tipo, url) {
  const cont = document.getElementById('hero-media'), safe = sanitizeURL(url);
  if (!cont || !safe || cont.dataset.url === safe) return;
  cont.dataset.url = safe; cont.innerHTML = '';
  let el;
  if (tipo === 'foto') { el = document.createElement('img'); el.alt = ''; el.src = safe; }
  else { el = document.createElement('video'); el.autoplay = el.muted = el.loop = el.playsInline = true; el.src = safe; }
  el.className = 'hero-video';
  cont.appendChild(el);
}

// WhatsApp e Instagram cargados en Tienda online → General
function aplicarContacto() {
  const wa = String(T.wa || '').replace(/\D/g, ''), ig = String(T.ig || '').replace(/[^\w.]/g, '');
  if (wa.length >= 10) {
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a => { a.href = 'https://wa.me/' + wa; });
    document.querySelectorAll('#footer-wa').forEach((el, i) => { if (i === 0) el.textContent = 'WA: +' + wa; });
  }
  if (ig) document.querySelectorAll('a[href*="instagram.com/"]').forEach(a => { a.href = 'https://www.instagram.com/' + ig + '/'; });
}

// ===== fotos y videos =====
function mediaDe(id) {
  const m = T && T.web && T.web.media && T.web.media[id];
  if (m && sanitizeURL(m[0])) return { url: m[0], video: !!m[1] };
  if (FOTOS.has(String(id))) return { url: FOTOS.get(String(id)), video: false };
  return null;
}
// Si un plato no tiene foto para la web pero sí en la tienda, se baja esa (una por plato, solo cuando se muestra)
function pedirFotos(lista, alLlegar) {
  const faltan = lista.filter(p => !mediaDe(p.gid) && T.fotos && T.fotos['p' + p.gid] && !FOTOS.has(String(p.gid)));
  faltan.forEach(p => {
    FOTOS.set(String(p.gid), '');
    fetch(DOC + '/fotos/p' + encodeURIComponent(p.gid)).then(r => r.ok ? r.json() : null).then(j => {
      const d = j && j.fields && j.fields.d && j.fields.d.stringValue;
      if (d && d.startsWith('data:image/')) { FOTOS.set(String(p.gid), d); alLlegar(); } else FOTOS.delete(String(p.gid));
    }).catch(() => FOTOS.delete(String(p.gid)));
  });
}
function portadaCategoria(cat) {
  const el = document.querySelector(`.comida-card-cat[onclick*="'${cat}'"] .comida-card-cat-bg`);
  const m = el && /url\(['"]?([^'")]+)/.exec(el.getAttribute('style') || '');
  return m ? m[1] : '';
}

// ===== «cocinar en casa» =====
function casaNombres() {
  if (!T || !Array.isArray(T.cats)) return [];
  if (T.casa) return T.casa.on ? (T.casa.cats || []) : [];
  return T.cats.map(c => c.n).filter(n => /congelad/i.test(n));
}
function armarCasa() {
  const nombres = new Set(casaNombres());
  const cats = T && Array.isArray(T.cats) ? T.cats.filter(c => nombres.has(c.n) && (c.items || []).length) : [];
  const sec = (T && T.web && T.web.sec) || {};
  productos = cats.flatMap(c => c.items.map(it => ({ gid: it.id, nombre: it.n, desc: it.d || '', precio: +it.p || 0, categoria: c.n })));
  SECCIONES = cats.map((c, i) => {
    const primero = c.items.map(it => mediaDe(it.id)).find(m => m && !m.video);
    return { id: 'gc' + i, nombre: c.n, subtitulo: c.d || '', categorias: [c.n], imagen: sec[c.n] || (primero && primero.url) || '' };
  });
  const ver = productos.length > 0;
  const main = document.getElementById('main-contenido');
  if (main) main.style.display = ver ? '' : 'none';
  document.querySelectorAll('.nav-link[data-casa], .hero-cta-primary, .marquee-casa').forEach(el => { el.style.display = ver ? '' : 'none'; });
  renderSecciones();
  const vp = document.getElementById('vista-productos');
  if (vp && vp.style.display === 'block') {
    const s = SECCIONES.find(x => x.nombre.toUpperCase() === document.getElementById('titulo-seccion').textContent);
    if (s) renderProductos(productos.filter(p => s.categorias.includes(p.categoria))); else irAInicio(true);
  }
}
function irAInicio(sinScroll) {
  document.getElementById('vista-secciones').style.display = 'block';
  document.getElementById('vista-productos').style.display = 'none';
  renderSecciones();
  if (sinScroll !== true) window.scrollTo({ top: document.querySelector('main').offsetTop - 80, behavior: 'smooth' });
}
function irASeccion(id) {
  const s = SECCIONES.find(x => x.id === id); if (!s) return;
  const lista = productos.filter(p => s.categorias.includes(p.categoria));
  document.getElementById('vista-secciones').style.display = 'none';
  document.getElementById('vista-productos').style.display = 'block';
  document.getElementById('titulo-seccion').textContent = s.nombre.toUpperCase();
  document.getElementById('count-productos').textContent = lista.length + ' producto' + (lista.length !== 1 ? 's' : '');
  renderProductos(lista);
  window.scrollTo({ top: document.querySelector('main').offsetTop - 80, behavior: 'smooth' });
  history.pushState({ tipo: 'seccion' }, '', '');
}
function renderSecciones() {
  const grid = document.getElementById('grid-secciones'); if (!grid) return;
  grid.innerHTML = SECCIONES.map((s, i) => {
    const cant = productos.filter(p => s.categorias.includes(p.categoria)).length, img = sanitizeURL(s.imagen);
    return `<div class="card-seccion" style="animation-delay:${i * 0.1}s" onclick="irASeccion('${s.id}')">
        <div class="card-seccion-bg" style="${img ? `background-image:url('${img}')` : ''}"></div>
        <div class="card-seccion-overlay"></div>
        <div class="card-seccion-content">
          <span class="card-seccion-emoji">🥟</span>
          <div class="card-seccion-nombre">${escapeHTML(s.nombre)}</div>
          <span class="card-seccion-sub">${escapeHTML(s.subtitulo)}</span>
          <div class="card-seccion-footer"><span class="card-seccion-cant">${cant} producto${cant !== 1 ? 's' : ''}</span><span class="card-seccion-arrow">Ver todo →</span></div>
        </div>
      </div>`;
  }).join('');
}
function renderProductos(lista) {
  const grid = document.getElementById('grid-productos'); if (!grid) return;
  if (!lista.length) { grid.innerHTML = '<div class="no-productos">SIN PRODUCTOS EN ESTA SECCIÓN AÚN</div>'; return; }
  grid.innerHTML = lista.map((p, i) => {
    const m = mediaDe(p.gid), url = m ? sanitizeURL(m.url) : '', link = PEDIR_URL + '?plato=' + encodeURIComponent(p.gid);
    const media = !url ? '<div class="card-emoji-fallback">🍝</div>' : m.video
      ? `<video class="card-img" src="${url}" muted loop playsinline preload="metadata"></video>`
      : `<img src="${url}" alt="${escapeHTML(p.nombre)}" class="card-img" loading="lazy" />`;
    return `<div class="card" style="animation-delay:${i * 0.06}s" onclick="location.href='${link}'">
      <div class="card-img-wrap"><span class="card-cat-badge">${escapeHTML(p.categoria)}</span>${media}</div>
      <div class="card-body">
        <div class="card-nombre">${escapeHTML(p.nombre)}</div>
        <div class="card-desc">${escapeHTML(p.desc)}</div>
        <div class="card-footer">
          <div><div class="precio">${plata(p.precio)}</div></div>
          <a class="btn-agregar" href="${link}" onclick="event.stopPropagation()">Pedir →</a>
        </div>
      </div>
    </div>`;
  }).join('');
  pedirFotos(lista, () => renderProductos(lista));
}

// ===== Comida Lista =====
function armarComidaLista() {
  const casa = new Set(casaNombres()), lista = [];
  (T && Array.isArray(T.cats) ? T.cats : []).forEach(c => {
    if (casa.has(c.n) || /congelad/i.test(c.n)) return;
    const cat = nz(c.n).includes('pizza') ? 'pizzas' : nz(c.n).includes('pasta') ? 'pastas' : null;
    if (!cat) return;
    (c.items || []).forEach(it => lista.push({ id: 'g' + it.id, gid: it.id, categoria: cat, nombre: it.n, desc: it.d || '', precio: +it.p || 0, desde: Array.isArray(it.o) && it.o.length > 0 }));
  });
  comidaLista = lista;
  actualizarConteosComida();
  const vp = document.getElementById('comida-vista-platos');
  if (vp && vp.style.display !== 'none') renderComidaLista();
}
function actualizarConteosComida() {
  ['pizzas', 'pastas'].forEach(cat => {
    const n = comidaLista.filter(p => p.categoria === cat).length, el = document.getElementById('count-' + cat);
    if (el) el.textContent = T ? n + (n === 1 ? ' plato' : ' platos') : '—';
  });
}
function irACategoriaComida(categoria) {
  comidaCategoriaActiva = categoria;
  document.getElementById('comida-vista-categorias').style.display = 'none';
  document.getElementById('comida-vista-platos').style.display = 'block';
  document.getElementById('comida-platos-titulo').textContent = categoria === 'pizzas' ? '🍕 PIZZAS' : '🍝 PASTAS';
  renderComidaLista();
  const sec = document.getElementById('comida-lista');
  if (sec) window.scrollTo({ top: sec.offsetTop - 70, behavior: 'smooth' });
  history.pushState({ tipo: 'categoria-comida' }, '', '');
}
function volverACategoriasComida() {
  document.getElementById('comida-vista-platos').style.display = 'none';
  document.getElementById('comida-vista-categorias').style.display = 'block';
  const sec = document.getElementById('comida-lista');
  if (sec) window.scrollTo({ top: sec.offsetTop - 70, behavior: 'smooth' });
}
function renderComidaLista() {
  const grid = document.getElementById('comida-grid'); if (!grid) return;
  if (!T) { grid.innerHTML = '<div class="comida-loading">Cargando menú...</div>'; return; }
  const lista = comidaLista.filter(p => p.categoria === comidaCategoriaActiva);
  const cnt = document.getElementById('comida-platos-count');
  if (cnt) cnt.textContent = lista.length + (lista.length === 1 ? ' plato' : ' platos');
  if (!lista.length) { grid.innerHTML = `<div class="comida-loading">Pronto vamos a tener ${comidaCategoriaActiva} 🍳</div>`; return; }
  grid.innerHTML = lista.map((p, i) => {
    const m = mediaDe(p.gid), url = sanitizeURL(m ? m.url : portadaCategoria(p.categoria)), nombre = escapeHTML(p.nombre);
    const media = m && m.video
      ? `<video class="comida-card-media" src="${url}" muted loop playsinline preload="metadata" onmouseover="this.play().catch(()=>{})" onmouseout="this.pause()"></video>`
      : `<img class="comida-card-media" src="${url}" alt="${nombre}" loading="lazy" />`;
    return `<div class="comida-card" style="animation-delay:${i * 0.05}s" onclick="abrirModalComida('${escapeHTML(p.id)}')">
        ${media}
        <div class="comida-card-overlay">
          <div class="comida-card-nombre">${nombre}</div>
          ${p.precio ? `<div class="comida-card-precio">${p.desde ? 'desde ' : ''}${plata(p.precio)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
  pedirFotos(lista, renderComidaLista);
}
function abrirModalComida(id) {
  const p = comidaLista.find(x => x.id === id); if (!p) return;
  const m = mediaDe(p.gid), url = sanitizeURL(m ? m.url : portadaCategoria(p.categoria));
  document.getElementById('modal-comida-media').innerHTML = m && m.video
    ? `<video src="${url}" controls autoplay muted loop playsinline class="modal-comida-video"></video>`
    : `<img src="${url}" alt="${escapeHTML(p.nombre)}" class="modal-comida-img" />`;
  document.getElementById('modal-comida-badge').textContent = p.categoria === 'pizzas' ? '🍕 Pizza' : '🍝 Pasta';
  document.getElementById('modal-comida-nombre').textContent = p.nombre;
  document.getElementById('modal-comida-desc').textContent = p.desc;
  const wrap = document.getElementById('modal-comida-precio-wrap'), pr = document.getElementById('modal-comida-precio');
  if (wrap && pr) { wrap.style.display = p.precio ? '' : 'none'; pr.textContent = p.precio ? (p.desde ? 'desde ' : '') + plata(p.precio) : ''; }
  const btn = document.getElementById('modal-comida-btn-fudo');
  if (btn) btn.href = PEDIR_URL + '?plato=' + encodeURIComponent(p.gid);
  document.getElementById('modal-comida').classList.add('visible');
  document.body.style.overflow = 'hidden';
  history.pushState({ tipo: 'modal-comida' }, '', '');
}
function cerrarModalComida() {
  const modal = document.getElementById('modal-comida');
  if (!modal.classList.contains('visible')) return;
  modal.classList.remove('visible');
  document.body.style.overflow = '';
  document.getElementById('modal-comida-media').innerHTML = '';
}

// ===== botón «atrás» del celular =====
window.addEventListener('popstate', () => {
  const modal = document.getElementById('modal-comida');
  if (modal && modal.classList.contains('visible')) { cerrarModalComida(); return; }
  if (document.getElementById('comida-vista-platos').style.display === 'block') { volverACategoriasComida(); return; }
  if (document.getElementById('vista-productos').style.display === 'block') { irAInicio(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModalComida(); });

cargar();
setInterval(cargar, 5 * 60 * 1000);
