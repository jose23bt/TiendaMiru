/* Datos sueltos de la página que vienen del gestor: foto de portada, WhatsApp, Instagram, horarios y formas de pago */
import { $, $$, waNum, urlOk } from './util.js';
import { estado } from './datos.js';

// Foto grande de la portada (Página web → Portada en el gestor): es la que se ve antes de que arranque el video
// y la que queda si el video no se carga. Cambia recién cuando la nueva terminó de cargar.
export function fotoPortada() {
  const w = estado.T.web || {};
  if (!w.hero || w.hero.tipo !== 'foto') return; // la portada es siempre una foto
  const url = w.hero.url, c = $('#hero-media');
  if (!c || !urlOk(url) || c.dataset.url === url) return;
  const el = new Image(); el.alt = 'Pizza recién salida del horno a leña'; el.className = 'vivo';
  el.onload = () => {
    c.dataset.url = url;
    const viejo = c.querySelector('picture, img.vivo'); if (viejo) viejo.remove(); // el video de portada (si está) queda encima
    c.prepend(el);
  };
  el.src = url;
}

// WhatsApp, Instagram y horarios (Tienda online → General)
export function contacto() {
  const T = estado.T, wa = waNum(T.wa), ig = String(T.ig || '').replace(/[^\w.]/g, '');
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

// Formas de pago: Mercado Pago aparece solo si está activado en el gestor
export function pagos() {
  const mp = !!estado.T.mp;
  $$('[data-mp]').forEach(el => { el.hidden = !mp; });
  const textos = [
    ['#aviso-pagos', 'Mercado Pago, transferencia o efectivo al recibir.', 'Transferencia o efectivo al recibir.'],
    ['#faq-pagos', 'Con Mercado Pago al pedir online, por transferencia o en efectivo al recibir.', 'Por transferencia o en efectivo al recibir.'],
    ['#paso-pago', 'Con Mercado Pago al toque, por transferencia o en efectivo cuando llega.', 'Por transferencia o en efectivo cuando llega.'],
  ];
  textos.forEach(([sel, con, sin]) => { const el = $(sel); if (el) el.textContent = mp ? con : sin; });
}
