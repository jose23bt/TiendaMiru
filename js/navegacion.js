/* Cómo se mueve la página: pestañas, menú del celular, encabezado que se achica, sección actual marcada,
   barra de abajo del celular y secciones que aparecen al bajar. No depende de la carta. */
import { $, $$ } from './util.js';
import { estado } from './datos.js';
import { elegirTab } from './carta.js';

export function iniciarNavegacion() {
  // Pestañas (Pizzas / Pastas / Promos) y menú ☰ del celular
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { elegirTab(t.dataset.tab); if (t.tagName === 'BUTTON') return; }
    const menu = e.target.closest('#hd-menu'), nav = $('#hd-nav');
    if (menu && nav) { const ab = nav.classList.toggle('abierto'); menu.setAttribute('aria-expanded', String(ab)); return; }
    if (nav && nav.classList.contains('abierto') && e.target.closest('#hd-nav a')) { nav.classList.remove('abierto'); $('#hd-menu').setAttribute('aria-expanded', 'false'); }
  });

  // Flechas izquierda/derecha entre pestañas (teclado)
  document.addEventListener('keydown', e => {
    const b = e.target.closest && e.target.closest('.pestanas [role="tab"]'); if (!b || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const vis = $$('.pestanas [role="tab"]').filter(x => !x.hidden), i = vis.indexOf(b), sig = vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length];
    sig.focus(); elegirTab(sig.dataset.tab);
  });

  // Encabezado más chico al bajar
  let pend = false;
  const achicar = () => { document.body.classList.toggle('bajo', scrollY > 40); pend = false; };
  addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(achicar); } }, { passive: true });
  achicar();

  if (!('IntersectionObserver' in window)) { document.body.classList.add('cta-visible'); return; }

  // Celular: la barra fija «Pedir online» aparece recién cuando ya no se ven los botones de la portada
  const ctas = $('.hero-ctas');
  if (ctas) new IntersectionObserver(([e]) => document.body.classList.toggle('cta-visible', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(ctas);
  else document.body.classList.add('cta-visible');

  // Secciones que aparecen al bajar. Se ven siempre por defecto: solo se esconden si el navegador las puede volver a mostrar.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('espera'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    $$('.revela').forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('espera'); io.observe(el); } });
    // por las dudas: cualquier sección que ya llegó a la pantalla se muestra aunque el observador no haya avisado
    addEventListener('scroll', () => $$('.revela.espera').forEach(el => { if (el.getBoundingClientRect().top < innerHeight) el.classList.remove('espera'); }), { passive: true });
  }

  // Marca en el menú y en los accesos del celular la sección que se está viendo
  const marcar = id => {
    $$('[data-espia]').forEach(a => a.classList.toggle('activo', a.dataset.espia === id));
    $$('.atajos [data-tab]').forEach(a => a.classList.toggle('activo', id === 'comida' && a.dataset.tab === estado.tab));
    const chip = $('.atajos .activo'), barra = $('.atajos');
    if (chip && barra && barra.scrollWidth > barra.clientWidth) barra.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
  };
  const espia = new IntersectionObserver(es => {
    const v = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (v) marcar(v.target.id);
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .25, .5] });
  ['comida', 'promo', 'casa', 'nosotros', 'preguntas'].forEach(id => { const el = document.getElementById(id); if (el) espia.observe(el); });
}
