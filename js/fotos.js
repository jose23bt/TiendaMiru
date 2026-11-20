/* Fotos propias de cada plato (sesiones de fotos de MIRU, guardadas en Imagenes/platos/).
   Se usan cuando el plato no tiene foto cargada en el gestor. Se eligen por el nombre del plato.
   Para sumar una: guardar la foto en Imagenes/platos/ (800×600) y agregar una línea acá. */
import { nz } from './util.js';

// Van de la más específica a la más general: «fugazzeta rellena» antes que «fugazzeta».
const PROPIAS = [
  [/fugazzeta.*rellen|rellen.*fugazzeta/, 'fugazzeta-rellena'], [/fugazzeta|fugazza/, 'fugazzeta'],
  [/napo.*especial|especial.*napo/, 'napolitana-especial'], [/napo/, 'napolitana'],
  [/margarita|muzza|mozza/, 'margarita'], [/cuatro quesos|4 quesos/, 'cuatro-quesos'], [/jamon.*morron|morron/, 'jamon-morrones'],
  [/pepperoni|peperoni/, 'pepperoni'], [/dijon/, 'dijon'], [/extravagan/, 'extravagancia'], [/palmito/, 'palmitos'],
  [/raviol.*(carne|cerdo|osobuco)|agn?[oe]l+ott?i/, 'ravioles-carne'], [/raviol/, 'ravioles-ricota'],
  [/noqui.*rellen/, 'noqui-relleno'], [/noqui.*hongo|hongo.*noqui/, 'noquis-hongos'], [/noqui/, 'noquis'],
  [/fagottini.*(cerdo|bondiola)/, 'fagottini-cerdo'], [/fagottini/, 'fagottini'], [/pappardelle|papardelle/, 'pappardelle'],
  [/tortell?ini/, 'tortellini-calabaza'], [/sorrentino.*capres/, 'sorrentinos-caprese'], [/sorrentino/, 'sorrentinos'],
  [/pici/, 'pici'], [/tallarin|fettuc|spaghet|espaguet/, 'tallarines'], [/lasa(n|ñ)a/, 'lasana'],
];
export const propiaDe = nombre => { const n = nz(nombre); const x = PROPIAS.find(([r]) => r.test(n)); return x ? 'Imagenes/platos/' + x[1] + '.jpg' : ''; };
