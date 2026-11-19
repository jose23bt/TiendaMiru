/* Herramientas chicas que usan todas las partes de la portada */

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

// Texto seguro para meter dentro del HTML (evita que un nombre con < o " rompa la página)
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 26650 → «$26.650»
export const plata = n => '$' + Math.round(+n || 0).toLocaleString('es-AR');

// minúsculas y sin tildes, para comparar nombres de secciones («Pastas Congeladas» → «pastas congeladas»)
export const nz = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// número de WhatsApp en formato internacional: «11 6188-5130» → 5491161885130
export const waNum = v => {
  let n = String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  if (/^15\d{8}$/.test(n)) n = '11' + n.slice(2);
  if (n.length === 10) n = '549' + n;
  else if (/^54[1-8]\d{9}$/.test(n)) n = '549' + n.slice(2);
  return n.length >= 12 ? n : '';
};

// solo se aceptan fotos o videos con https (o fotos ya incrustadas)
export const urlOk = u => typeof u === 'string' && (/^https:\/\//.test(u) || u.startsWith('data:image/'));
