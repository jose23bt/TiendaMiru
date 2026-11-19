/* Secciones con platos: «Comida lista» (pestañas, destacadas del celular y lista), la promo y «Para cocinar en casa» */
import { $, $$, esc, plata, urlOk } from './util.js';
import { estado, PEDIR, RESPALDO, grupos, casaNombres, mediaHtml, pedirFotos } from './datos.js';

const enlacePlato = id => PEDIR + '?plato=' + encodeURIComponent(id); // abre ese plato en la tienda
const tieneAdicionales = it => Array.isArray(it.o) && it.o.length > 0;  // el precio se muestra «desde»

// ===== comida lista =====
export function armarComida() {
  const g = grupos();
  ['pizzas', 'pastas', 'promos'].forEach(k => { const b = $('#tab-' + k); if (b) { b.hidden = !g[k].length; b.dataset.cant = g[k].length; } });
  $$('.atajos [data-tab]').forEach(a => { a.hidden = !g[a.dataset.tab].length; });
  if (!g[estado.tab].length) estado.tab = ['pizzas', 'pastas', 'promos'].find(k => g[k].length) || 'pizzas';
  pintarGrilla(g);
}

export function elegirTab(k) { estado.tab = k; pintarGrilla(); }

function pintarGrilla(g = grupos()) {
  const tab = estado.tab, lista = g[tab], grilla = $('#grilla-comida'); if (!grilla) return;
  $$('.pestanas [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('.atajos [data-tab]').forEach(a => a.classList.toggle('activo', a.dataset.tab === tab));
  grilla.setAttribute('aria-labelledby', 'tab-' + tab);
  if (!lista.length) { grilla.innerHTML = '<div class="cargando">Pronto vamos a tener más platos acá.</div>'; return; }
  const total = g.pizzas.length + g.pastas.length + g.promos.length;
  pintarDestacadas(lista);
  grilla.innerHTML = lista.map((it, i) => `<a class="plato" href="${enlacePlato(it.id)}" style="animation-delay:${Math.min(i, 12) * .04}s">
      <div class="plato-foto">${mediaHtml(it.id, tab, it.n)}</div>
      <div class="plato-cuerpo">
        <div class="plato-nombre">${esc(it.n)}</div>
        ${it.d ? `<div class="plato-desc">${esc(it.d)}</div>` : ''}
        <div class="plato-pie"><span class="plato-precio">${tieneAdicionales(it) ? '<small>desde</small>' : ''}${plata(it.p)}</span><span class="plato-pedir">Pedir →</span></div>
      </div>
    </a>`).join('') + `<a class="ver-todo" href="${PEDIR}">
      <div class="eyebrow oscuro">${total} platos en la carta</div>
      <b>VER TODA <br>LA CARTA →</b>
      <span>${tab === 'pastas' ? 'Cada pasta con el adicional que elijas.' : 'Pedís online y seguís el estado desde el celular.'}</span>
    </a>`;
  pedirFotos(lista, () => pintarGrilla());
}

// Celular: arriba, los primeros platos en fotos grandes que se deslizan; abajo, la lista completa
function pintarDestacadas(lista) {
  const d = $('#destacadas'); if (!d) return;
  const tab = estado.tab;
  const nota = tab === 'pastas' ? 'Con adicionales a elección' : tab === 'promos' ? 'Precios de promo' : 'Masa fermentada 48 hs';
  const top = lista.length >= 4 ? lista.slice(0, 3) : [];
  d.innerHTML = (top.length ? `<div class="dest-cab"><b>Destacadas</b><span aria-hidden="true">Deslizá →</span></div>
    <div class="dest-pista">${top.map((it, i) => `<a class="dest" href="${enlacePlato(it.id)}" style="animation-delay:${i * .06}s">${mediaHtml(it.id, tab, it.n)}
        <div class="dest-txt"><b>${esc(it.n)}</b><span>${tieneAdicionales(it) ? '<small>desde</small> ' : ''}${plata(it.p)}</span></div><i class="dest-mas" aria-hidden="true">+</i></a>`).join('')}</div>` : '')
    + `<div class="lista-cab"><b>Toda la carta</b><span>${nota}</span></div>`;
}

// ===== promo destacada (la primera de la sección de promos) =====
export function armarPromo() {
  const T = estado.T, p = grupos().promos, sec = $('#promo');
  $$('.atajos [data-promo]').forEach(a => { a.hidden = !p.length; });
  if (!sec) return;
  sec.hidden = !p.length; if (!p.length) return;
  const [a, ...resto] = p;
  $('#promo-nombre').textContent = a.n.toUpperCase();
  $('#promo-precio').textContent = plata(a.p);
  $('#promo-link').href = enlacePlato(a.id);
  const otras = $('#promo-otras');
  otras.hidden = !resto.length;
  otras.textContent = resto.length ? 'También: ' + resto.map(x => x.n + ' a ' + plata(x.p)).join(', ') + '.' : '';
  const m = T.web && T.web.media && T.web.media[a.id];
  if (m && urlOk(m[0])) $('#promo-foto').innerHTML = mediaHtml(a.id, 'promos', a.n);
}

// ===== para cocinar en casa (se ve solo si está activada y tiene productos) =====
export function armarCasa() {
  const T = estado.T, nombres = new Set(casaNombres()), sec = (T.web && T.web.sec) || {};
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
