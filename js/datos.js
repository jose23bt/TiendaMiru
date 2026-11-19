/* La carta que publica el gestor (proyecto gestor-f693d, documento tienda/miru) y las fotos de cada plato.
   Todo lo que se ve en la portada sale de acá: platos, precios, promos, fotos, WhatsApp, horarios, Mercado Pago. */
import { nz, esc, urlOk } from './util.js';

export const PEDIR = '/pedir/';
export const DOC = 'https://firestore.googleapis.com/v1/projects/gestor-f693d/databases/(default)/documents/tienda/miru';
export const VISTA = new URLSearchParams(location.search).has('vista'); // ?vista=1: vista previa dentro del gestor
export const GESTOR_ORIGENES = ['https://gestor-f693d.web.app', 'https://gestor-f693d.firebaseapp.com', 'http://localhost:5000', 'http://127.0.0.1:5000'];

// fotos que se usan si un plato no tiene ninguna
export const RESPALDO = {
  pizzas: 'Imagenes/web/hero-pizza.jpg',
  pastas: 'Imagenes/web/portada-fresca.jpg',
  promos: 'Imagenes/web/margarita.jpg',
  casa: 'Imagenes/web/portada-rellenas.jpg',
};

// lo que cambia mientras la página está abierta
export const estado = {
  T: null,        // la carta publicada por el gestor
  tab: 'pizzas',  // pestaña elegida en «Comida lista»
};
const FOTOS = new Map(); // id de plato → foto de la tienda (se baja solo si hace falta)

// Lee la carta. Devuelve true si llegó una nueva.
export async function cargar() {
  try {
    const r = await fetch(DOC, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const nuevo = JSON.parse((await r.json()).fields.j.stringValue);
    if (VISTA && estado.T) return false; // en la vista previa manda lo que se está editando en el gestor
    estado.T = nuevo;
    return true;
  } catch (e) {
    console.error('No se pudo leer la carta del gestor:', e);
    return false;
  }
}

// secciones de la carta que van en «Compra aquí para cocinar en casa»
export function casaNombres() {
  const T = estado.T;
  if (!T || !Array.isArray(T.cats)) return [];
  if (T.casa) return T.casa.on ? (T.casa.cats || []) : [];
  return T.cats.map(c => c.n).filter(n => /congelad/i.test(n));
}

// platos de «Comida lista» repartidos en pizzas, pastas y promos (según el nombre de la sección)
export function grupos() {
  const T = estado.T, casa = new Set(casaNombres()), g = { pizzas: [], pastas: [], promos: [] };
  (T && Array.isArray(T.cats) ? T.cats : []).forEach(c => {
    if (casa.has(c.n) || /congelad/i.test(c.n)) return;
    const n = nz(c.n), k = n.includes('promo') ? 'promos' : n.includes('pizza') ? 'pizzas' : n.includes('pasta') ? 'pastas' : null;
    if (k) (c.items || []).forEach(it => g[k].push(it));
  });
  return g;
}

// ===== fotos y videos de cada plato =====
// prioridad: la que se subió en «Página web» del gestor → la de la tienda → la de respaldo
export function media(id, cat) {
  const T = estado.T, m = T.web && T.web.media && T.web.media[id];
  if (m && urlOk(m[0])) return { url: m[0], video: !!m[1] };
  const f = FOTOS.get(String(id)); if (f) return { url: f, video: false };
  return { url: RESPALDO[cat] || RESPALDO.pizzas, video: false };
}
export function mediaHtml(id, cat, nombre) {
  const m = media(id, cat);
  return m.video
    ? `<video src="${esc(m.url)}" muted loop playsinline preload="metadata" aria-label="${esc(nombre)}"></video>`
    : `<img src="${esc(m.url)}" alt="${esc(nombre)}" loading="lazy">`;
}
// Platos sin foto para la web pero con foto en la tienda: se baja esa (una por plato, cuando se muestra)
export function pedirFotos(items, listo) {
  const T = estado.T;
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
