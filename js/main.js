/* =====================================================================
   tiendamiru.com — portada. Punto de entrada: arranca todo.
   Todo sale del gestor (proyecto gestor-f693d), de la carta que publica la app de Gestión en tienda/miru.
   Los pedidos se hacen en la tienda: /pedir/ (copia de la tienda del gestor, la genera publicar-web.ps1).

   js/util.js        herramientas chicas ($, esc, plata, waNum…)
   js/datos.js       lee la carta del gestor y las fotos de los platos
   js/portada.js     foto de portada, WhatsApp, Instagram, horarios, formas de pago
   js/carta.js       comida lista (pestañas, destacadas, lista), promo y «para cocinar en casa»
   js/google.js      datos para Google: carta con precios y preguntas frecuentes
   js/navegacion.js  pestañas, menú, encabezado, sección actual, barra del celular, aparición al bajar
   js/chat.js        chat de preguntas (lo copia publicar-web.ps1 desde el gestor: no editar acá)
   ===================================================================== */
import { $ } from './util.js';
import { estado, cargar, VISTA, PEDIR, GESTOR_ORIGENES } from './datos.js';
import { fotoPortada, contacto, pagos } from './portada.js';
import { armarComida, armarPromo, armarCasa } from './carta.js';
import { datosGoogle } from './google.js';
import { iniciarNavegacion } from './navegacion.js';

// vuelve a dibujar todo lo que depende de la carta
function aplicar() {
  fotoPortada();
  contacto();
  pagos();
  armarComida();
  armarPromo();
  armarCasa();
  datosGoogle();
}

async function actualizar() {
  if (await cargar()) aplicar();
  else if (!estado.T) { const g = $('#grilla-comida'); if (g) g.innerHTML = `<a class="cargando" href="${PEDIR}">No pudimos cargar la carta. Tocá acá para verla en la tienda.</a>`; }
}

iniciarNavegacion();

if (VISTA) {
  // vista previa del gestor: recibe por mensaje lo que se está editando
  addEventListener('message', e => {
    if (!GESTOR_ORIGENES.includes(e.origin) || !e.data || e.data.tn !== 'datos' || !e.data.T || !Array.isArray(e.data.T.cats)) return;
    estado.T = e.data.T; aplicar();
  });
  if (parent !== window) parent.postMessage({ tn: 'listo' }, '*');
  actualizar();
} else {
  actualizar();
  setInterval(actualizar, 5 * 60 * 1000); // precios y platos al día sin recargar
}
