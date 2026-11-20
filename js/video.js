/* Videos de la portada y de «Así lo hacemos».
   · Portada: un video corto y sin sonido que se repite (fuego, masa, pizza saliendo del horno, pasta a mano).
     Primero se ve la foto (carga rápido) y el video aparece encima con un fundido cuando ya está listo.
     En el celular baja una versión vertical más liviana. No se baja si la persona pidió menos movimiento
     o tiene activado el ahorro de datos. Se pausa cuando no se ve (al bajar o al cambiar de pestaña).
   · «Así lo hacemos»: tres clips chicos que arrancan recién cuando aparecen en pantalla.
   Los archivos están en Imagenes/video/ (se arman con ffmpeg desde M:\MIRU\VIDEOS TERMINADOS). */
import { $, $$ } from './util.js';

const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const conexion = navigator.connection || {};
const ahorro = !!conexion.saveData || /(^|-)2g$/.test(conexion.effectiveType || '');
const puede = !sinMovimiento && !ahorro;

function nuevoVideo(src, clase) {
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.preload = 'auto'; v.className = clase; v.src = src;
  return v;
}
const reproducir = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

// pausa los videos que no se ven y los retoma al volver
function vigilar(v, caja) {
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? reproducir(v) : v.pause(); }, { threshold: .15 }).observe(caja);
  document.addEventListener('visibilitychange', () => { document.hidden || !visible ? v.pause() : reproducir(v); });
}

function portada() {
  const c = $('#hero-media'); if (!c || !puede) return;
  const movil = matchMedia('(max-width: 820px)').matches;
  const v = nuevoVideo('Imagenes/video/portada-' + (movil ? 'movil' : 'escritorio') + '.mp4', 'hero-video');
  v.addEventListener('playing', () => c.classList.add('con-video'), { once: true });
  c.insertBefore(v, c.querySelector('.hero-brillo'));
  reproducir(v); vigilar(v, c);
}

function procesos() {
  $$('[data-clip]').forEach(caja => {
    if (!puede) return; // queda la foto fija
    const arrancar = () => {
      if (caja.querySelector('video')) return;
      const v = nuevoVideo(caja.dataset.clip, 'clip');
      v.addEventListener('playing', () => caja.classList.add('con-video'), { once: true });
      caja.prepend(v); reproducir(v); vigilar(v, caja);
    };
    if (!('IntersectionObserver' in window)) { arrancar(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); arrancar(); } }, { rootMargin: '200px 0px' });
    io.observe(caja);
  });
}

// arranca después de que cargó la página, para no competir con la foto ni con la carta
export function iniciarVideos() {
  const ir = () => setTimeout(() => { portada(); procesos(); }, 250);
  if (document.readyState === 'complete') ir(); else addEventListener('load', ir, { once: true });
}
