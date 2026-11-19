/* Datos para Google (schema.org): la carta con precios y las preguntas frecuentes.
   El negocio, la web y la página están fijos en index.html; esto agrega lo que sale del gestor. */
import { $$ } from './util.js';
import { estado, VISTA, PEDIR, casaNombres } from './datos.js';

function poner(id, obj) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}

export function datosGoogle() {
  const T = estado.T;
  if (VISTA || !T || !Array.isArray(T.cats)) return;
  const casa = new Set(casaNombres());
  const secciones = T.cats.filter(c => (c.items || []).length && (!/congelad/i.test(c.n) || casa.has(c.n))).map(c => ({
    '@type': 'MenuSection', name: c.n, ...(c.d ? { description: c.d } : {}),
    hasMenuItem: c.items.filter(it => +it.p >= 100).map(it => ({ // precios absurdos (ej. $1 de prueba) no se mandan
      '@type': 'MenuItem', name: it.n, ...(it.d ? { description: it.d } : {}),
      offers: { '@type': 'Offer', price: String(Math.round(+it.p)), priceCurrency: 'ARS', availability: 'https://schema.org/InStock', url: 'https://tiendamiru.com' + PEDIR + '?plato=' + encodeURIComponent(it.id) },
    })),
  })).filter(s => s.hasMenuItem.length);
  poner('ld-carta', { '@context': 'https://schema.org', '@type': 'Menu', '@id': 'https://tiendamiru.com/#carta', name: 'Carta de MIRU', url: 'https://tiendamiru.com' + PEDIR, inLanguage: 'es-AR', hasMenuSection: secciones });

  const preguntas = $$('.faq details').map(d => ({ '@type': 'Question', name: d.querySelector('summary').textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() } }));
  if (preguntas.length) poner('ld-preguntas', { '@context': 'https://schema.org', '@type': 'FAQPage', '@id': 'https://tiendamiru.com/#preguntas', mainEntity: preguntas });
}
