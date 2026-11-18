/* =====================================================================
   tiendamiru.com — portada
   Todo sale del gestor (proyecto gestor-f693d), de la carta que publica la app de Gestión en tienda/miru:
   · platos, precios, promos y fotos (Carta y costos, Carta y fotos, Página web)
   · WhatsApp, Instagram, horarios y si se cobra con Mercado Pago (Tienda online → General)
   · qué secciones van en «Compra aquí para cocinar en casa» y si se muestra (Página web)
   Los pedidos se hacen en la tienda online: /pedir/. El chat de preguntas está en /chat.js.
   ?vista=1: vista previa dentro del gestor (recibe lo que se está editando por mensaje).
   ===================================================================== */
'use strict';

const PEDIR = '/pedir/';
const DOC = 'https://firestore.googleapis.com/v1/projects/gestor-f693d/databases/(default)/documents/tienda/miru';
const VISTA = new URLSearchParams(location.search).has('vista');
const GESTOR_ORIGENES = ['https://gestor-f693d.web.app', 'https://gestor-f693d.firebaseapp.com', 'http://localhost:5000', 'http://127.0.0.1:5000'];
const RESPALDO = { pizzas: 'Imagenes/web/hero-pizza.jpg', pastas: 'Imagenes/web/portada-fresca.jpg', promos: 'Imagenes/web/margarita.jpg', casa: 'Imagenes/web/portada-rellenas.jpg' };

let T = null;
let tab = 'pizzas';
const FOTOS = new Map(); // id de plato -> foto de la tienda (data URL), se bajan solo si hacen falta
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plata = n => '$' + Math.round(+n || 0).toLocaleString('es-AR');
const nz = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// número de WhatsApp en formato internacional: «11 6188-5130» → 5491161885130
const waNum = v => { let n = String(v || '').replace(/\D/g, '').replace(/^0+/, ''); if (/^15\d{8}$/.test(n)) n = '11' + n.slice(2); if (n.length === 10) n = '549' + n; else if (/^54[1-8]\d{9}$/.test(n)) n = '549' + n.slice(2); return n.length >= 12 ? n : ''; };
const urlOk = u => typeof u === 'string' && (/^https:\/\//.test(u) || u.startsWith('data:image/'));

// ===== carta =====
async function cargar() {
  try {
    const r = await fetch(DOC, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const nuevo = JSON.parse((await r.json()).fields.j.stringValue);
    if (VISTA && T) return;
    T = nuevo;
  } catch (e) {
    console.error('No se pudo leer la carta del gestor:', e);
    if (!T) { const g = $('#grilla-comida'); if (g) g.innerHTML = `<a class="cargando" href="${PEDIR}">No pudimos cargar la carta. Tocá acá para verla en la tienda.</a>`; }
    return;
  }
  aplicar();
}

function casaNombres() {
  if (!T || !Array.isArray(T.cats)) return [];
  if (T.casa) return T.casa.on ? (T.casa.cats || []) : [];
  return T.cats.map(c => c.n).filter(n => /congelad/i.test(n));
}
function grupos() {
  const casa = new Set(casaNombres()), g = { pizzas: [], pastas: [], promos: [] };
  (T && Array.isArray(T.cats) ? T.cats : []).forEach(c => {
    if (casa.has(c.n) || /congelad/i.test(c.n)) return;
    const n = nz(c.n), k = n.includes('promo') ? 'promos' : n.includes('pizza') ? 'pizzas' : n.includes('pasta') ? 'pastas' : null;
    if (k) (c.items || []).forEach(it => g[k].push(it));
  });
  return g;
}

function aplicar() {
  const w = T.web || {};
  if (w.hero && w.hero.tipo === 'foto') heroMedia(w.hero.url); // la portada es siempre una foto
  contacto();
  pagos();
  armarComida();
  armarPromo();
  armarCasa();
  datosGoogle();
}

// ===== datos para Google (schema.org): la carta con precios y las preguntas frecuentes =====
function ldPoner(id, obj) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}
function datosGoogle() {
  if (VISTA || !T || !Array.isArray(T.cats)) return;
  const casa = new Set(casaNombres());
  const secciones = T.cats.filter(c => (c.items || []).length && (!/congelad/i.test(c.n) || casa.has(c.n))).map(c => ({
    '@type': 'MenuSection', name: c.n, ...(c.d ? { description: c.d } : {}),
    hasMenuItem: c.items.filter(it => +it.p >= 100).map(it => ({
      '@type': 'MenuItem', name: it.n, ...(it.d ? { description: it.d } : {}),
      offers: { '@type': 'Offer', price: String(Math.round(+it.p)), priceCurrency: 'ARS', availability: 'https://schema.org/InStock', url: 'https://tiendamiru.com' + PEDIR + '?plato=' + encodeURIComponent(it.id) }
    }))
  })).filter(sx => sx.hasMenuItem.length);
  ldPoner('ld-carta', { '@context': 'https://schema.org', '@type': 'Menu', '@id': 'https://tiendamiru.com/#carta', name: 'Carta de MIRU', url: 'https://tiendamiru.com' + PEDIR, inLanguage: 'es-AR', hasMenuSection: secciones });
  const preguntas = $$('.faq details').map(d => ({ '@type': 'Question', name: d.querySelector('summary').textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() } }));
  if (preguntas.length) ldPoner('ld-preguntas', { '@context': 'https://schema.org', '@type': 'FAQPage', '@id': 'https://tiendamiru.com/#preguntas', mainEntity: preguntas });
}

function heroMedia(url) {
  const c = $('#hero-media'); if (!c || !urlOk(url) || c.dataset.url === url) return;
  const el = new Image(); el.alt = 'Pizza recién salida del horno a leña'; el.className = 'vivo';
  el.onload = () => { // cambia recién cuando la foto nueva terminó de cargar: sin parpadeo
    c.dataset.url = url;
    const viejo = c.querySelector('img, video'); if (viejo) viejo.remove();
    c.prepend(el);
  };
  el.src = url;
}

// WhatsApp, Instagram y horarios cargados en el gestor
function contacto() {
  const wa = waNum(T.wa), ig = String(T.ig || '').replace(/[^\w.]/g, '');
  if (wa.length >= 10) {
    $$('a[href^="https://wa.me/"]').forEach(a => { a.href = 'https://wa.me/' + wa; });
    const p = $('#pie-wa'); if (p) p.textContent = 'WhatsApp +' + wa;
  }
  if (ig) $$('a[href*="instagram.com/"]').forEach(a => { a.href = 'https://www.instagram.com/' + ig + '/'; });
  if (T.horarios && String(T.horarios).trim()) {
    const txt = String(T.horarios).trim(), h = $('#pie-horarios'); if (h) h.textContent = txt;
    const f = $('#faq-horarios'); if (f) f.textContent = txt.split(/\n+/).map(l => l.trim().replace(/[.;]$/, '')).filter(Boolean).join('. ') + '.';
  }
}
function pagos() {
  const mp = !!T.mp;
  $$('[data-mp]').forEach(el => { el.hidden = !mp; });
  const a = $('#aviso-pagos'); if (a) a.textContent = mp ? 'Mercado Pago, transferencia o efectivo al recibir.' : 'Transferencia o efectivo al recibir.';
  const fp = $('#faq-pagos'); if (fp) fp.textContent = mp ? 'Con Mercado Pago al pedir online, por transferencia o en efectivo al recibir.' : 'Por transferencia o en efectivo al recibir.';
  const p = $('#paso-pago'); if (p) p.textContent = mp ? 'Con Mercado Pago al toque, por transferencia o en efectivo cuando llega.' : 'Por transferencia o en efectivo cuando llega.';
}

// ===== fotos y videos =====
function media(id, cat) {
  const m = T.web && T.web.media && T.web.media[id];
  if (m && urlOk(m[0])) return { url: m[0], video: !!m[1] };
  const f = FOTOS.get(String(id)); if (f) return { url: f, video: false };
  return { url: RESPALDO[cat] || RESPALDO.pizzas, video: false };
}
function mediaHtml(id, cat, nombre) {
  const m = media(id, cat);
  return m.video
    ? `<video src="${esc(m.url)}" muted loop playsinline preload="metadata" aria-label="${esc(nombre)}"></video>`
    : `<img src="${esc(m.url)}" alt="${esc(nombre)}" loading="lazy">`;
}
// Platos sin foto para la web pero con foto en la tienda: se baja esa (una por plato, cuando se muestra)
function pedirFotos(items, listo) {
  items.forEach(it => {
    const id = String(it.id);
    if ((T.web && T.web.media && T.web.media[id]) || FOTOS.has(id) || !(T.fotos && T.fotos['p' + id])) return;
    FOTOS.set(id, '');
    fetch(DOC + '/fotos/p' + encodeURIComponent(id)).then(r => r.ok ? r.json() : null).then(j => {
      const d = j && j.fields && j.fields.d && j.fields.d.stringValue;
      if (d && d.startsWith('data:image/')) { FOTOS.set(id, d); listo(); } else FOTOS.delete(id);
    }).catch(() => FOTOS.delete(id));
  });
}

// ===== comida lista =====
function armarComida() {
  const g = grupos();
  ['pizzas', 'pastas', 'promos'].forEach(k => { const b = $('#tab-' + k); if (b) { b.hidden = !g[k].length; b.dataset.cant = g[k].length; } });
  $$('.atajos [data-tab]').forEach(a => { a.hidden = !g[a.dataset.tab].length; });
  if (!g[tab].length) tab = ['pizzas', 'pastas', 'promos'].find(k => g[k].length) || 'pizzas';
  pintarGrilla(g);
}
function pintarGrilla(g) {
  g = g || grupos();
  const lista = g[tab], grilla = $('#grilla-comida'); if (!grilla) return;
  $$('.pestanas [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('.atajos [data-tab]').forEach(a => a.classList.toggle('activo', a.dataset.tab === tab));
  grilla.setAttribute('aria-labelledby', 'tab-' + tab);
  if (!lista.length) { grilla.innerHTML = '<div class="cargando">Pronto vamos a tener más platos acá.</div>'; return; }
  const total = g.pizzas.length + g.pastas.length + g.promos.length;
  pintarDestacadas(lista);
  grilla.innerHTML = lista.map((it, i) => {
    const desde = Array.isArray(it.o) && it.o.length > 0;
    return `<a class="plato" href="${PEDIR}?plato=${encodeURIComponent(it.id)}" style="animation-delay:${Math.min(i, 12) * .04}s">
      <div class="plato-foto">${mediaHtml(it.id, tab, it.n)}</div>
      <div class="plato-cuerpo">
        <div class="plato-nombre">${esc(it.n)}</div>
        ${it.d ? `<div class="plato-desc">${esc(it.d)}</div>` : ''}
        <div class="plato-pie"><span class="plato-precio">${desde ? '<small>desde</small>' : ''}${plata(it.p)}</span><span class="plato-pedir">Pedir →</span></div>
      </div>
    </a>`;
  }).join('') + `<a class="ver-todo" href="${PEDIR}">
      <div class="eyebrow oscuro">${total} platos en la carta</div>
      <b>VER TODA <br>LA CARTA →</b>
      <span>${tab === 'pastas' ? 'Cada pasta con la salsa que elijas.' : 'Pedís online y seguís el estado desde el celular.'}</span>
    </a>`;
  pedirFotos(lista, () => pintarGrilla());
}
// Celular: arriba, los primeros platos de la carta en fotos grandes que se deslizan; abajo, la lista completa
function pintarDestacadas(lista) {
  const d = $('#destacadas'); if (!d) return;
  const nota = tab === 'pastas' ? 'Elegís la salsa al pedir' : tab === 'promos' ? 'Precios de promo' : 'Masa fermentada 48 hs';
  const top = lista.length >= 4 ? lista.slice(0, 3) : [];
  d.innerHTML = (top.length ? `<div class="dest-cab"><b>Destacadas</b><span aria-hidden="true">Deslizá →</span></div>
    <div class="dest-pista">${top.map((it, i) => {
      const desde = Array.isArray(it.o) && it.o.length > 0;
      return `<a class="dest" href="${PEDIR}?plato=${encodeURIComponent(it.id)}" style="animation-delay:${i * .06}s">${mediaHtml(it.id, tab, it.n)}
        <div class="dest-txt"><b>${esc(it.n)}</b><span>${desde ? '<small>desde</small> ' : ''}${plata(it.p)}</span></div><i class="dest-mas" aria-hidden="true">+</i></a>`;
    }).join('')}</div>` : '') + `<div class="lista-cab"><b>Toda la carta</b><span>${nota}</span></div>`;
}
function elegirTab(k) { tab = k; pintarGrilla(); }

// ===== promo destacada =====
function armarPromo() {
  const p = grupos().promos, sec = $('#promo');
  $$('.atajos [data-promo]').forEach(a => { a.hidden = !p.length; });
  if (!sec) return;
  sec.hidden = !p.length; if (!p.length) return;
  const [a, ...resto] = p;
  $('#promo-nombre').textContent = a.n.toUpperCase();
  $('#promo-precio').textContent = plata(a.p);
  $('#promo-link').href = PEDIR + '?plato=' + encodeURIComponent(a.id);
  const otras = $('#promo-otras');
  otras.hidden = !resto.length;
  otras.textContent = resto.length ? 'También: ' + resto.map(x => x.n + ' a ' + plata(x.p)).join(', ') + '.' : '';
  const m = T.web && T.web.media && T.web.media[a.id];
  if (m && urlOk(m[0])) $('#promo-foto').innerHTML = mediaHtml(a.id, 'promos', a.n);
}

// ===== para cocinar en casa =====
function armarCasa() {
  const nombres = new Set(casaNombres()), sec = (T.web && T.web.sec) || {};
  const cats = (T.cats || []).filter(c => nombres.has(c.n) && (c.items || []).length);
  const ver = cats.length > 0;
  const s = $('#casa'); if (s) s.hidden = !ver;
  $$('[data-casa]').forEach(el => { el.hidden = !ver; });
  const g = $('#casa-grilla'); if (!g || !ver) return;
  g.innerHTML = cats.map(c => {
    const foto = urlOk(sec[c.n]) ? sec[c.n] : (c.items.map(it => T.web && T.web.media && T.web.media[it.id]).find(m => m && urlOk(m[0]) && !m[1]) || [RESPALDO.casa])[0];
    return `<a class="casa-tarjeta" href="${PEDIR}">
      <img src="${esc(foto)}" alt="${esc(c.n)}" loading="lazy">
      <div><b>${esc(c.n)}</b><span>${esc(c.items.slice(0, 3).map(x => x.n).join(' · '))}${c.items.length > 3 ? ' y más' : ''}</span></div>
    </a>`;
  }).join('');
}

// ===== navegación =====
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) { elegirTab(t.dataset.tab); if (t.tagName === 'BUTTON') return; }
  const menu = e.target.closest('#hd-menu'), nav = $('#hd-nav');
  if (menu && nav) { const ab = nav.classList.toggle('abierto'); menu.setAttribute('aria-expanded', String(ab)); return; }
  if (nav && nav.classList.contains('abierto') && e.target.closest('#hd-nav a')) { nav.classList.remove('abierto'); $('#hd-menu').setAttribute('aria-expanded', 'false'); }
});
// flechas izquierda/derecha entre pestañas (accesibilidad de teclado)
document.addEventListener('keydown', e => {
  const b = e.target.closest && e.target.closest('.pestanas [role="tab"]'); if (!b || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const vis = $$('.pestanas [role="tab"]').filter(x => !x.hidden), i = vis.indexOf(b), sig = vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length];
  sig.focus(); elegirTab(sig.dataset.tab);
});

// Celular: el botón fijo «Pedir online» aparece recién cuando ya no se ven los de la portada
(function () {
  const ctas = $('.hero-ctas'); if (!ctas || !('IntersectionObserver' in window)) { document.body.classList.add('cta-visible'); return; }
  new IntersectionObserver(([e]) => document.body.classList.toggle('cta-visible', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(ctas);
})();

// Secciones que aparecen al bajar (funciona en todos los celulares; si algo falla, se ven igual)
(function () {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.remove('espera'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -6% 0px' });
  $$('.revela').forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('espera'); io.observe(el); } });
  // por las dudas: al desplazarse, cualquier sección que ya llegó a la pantalla se muestra aunque el observador no haya avisado
  addEventListener('scroll', () => $$('.revela.espera').forEach(el => { if (el.getBoundingClientRect().top < innerHeight) el.classList.remove('espera'); }), { passive: true });
})();

// Encabezado más chico al bajar
(function () {
  let t = false;
  const f = () => { document.body.classList.toggle('bajo', scrollY > 40); t = false; };
  addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(f); } }, { passive: true }); f();
})();

// Marca en el menú y en los accesos del celular la sección que se está viendo
(function () {
  if (!('IntersectionObserver' in window)) return;
  const marcar = id => {
    $$('[data-espia]').forEach(a => a.classList.toggle('activo', a.dataset.espia === id));
    if (id === 'comida') $$('.atajos [data-tab]').forEach(a => a.classList.toggle('activo', a.dataset.tab === tab));
    else $$('.atajos [data-tab]').forEach(a => a.classList.remove('activo'));
    const chip = $('.atajos .activo'), barra = $('.atajos');
    if (chip && barra && barra.scrollWidth > barra.clientWidth) barra.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
  };
  const obs = new IntersectionObserver(es => {
    const v = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (v) marcar(v.target.id);
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .25, .5] });
  ['comida', 'promo', 'casa', 'nosotros', 'preguntas'].forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
})();

if (VISTA) {
  addEventListener('message', e => {
    if (!GESTOR_ORIGENES.includes(e.origin) || !e.data || e.data.tn !== 'datos' || !e.data.T || !Array.isArray(e.data.T.cats)) return;
    T = e.data.T; aplicar();
  });
  if (parent !== window) parent.postMessage({ tn: 'listo' }, '*');
  cargar();
} else {
  cargar();
  setInterval(cargar, 5 * 60 * 1000);
}
