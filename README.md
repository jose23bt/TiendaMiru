# tiendamiru.com

La página web de MIRU. Es una página estática (HTML, CSS y JavaScript, sin programas que la armen) publicada en GitHub Pages, detrás de Cloudflare. Platos, precios, fotos, horarios y WhatsApp **no se escriben acá**: se cargan en el gestor y la página los lee sola.

## Qué hay en cada lugar

```
files/
├── index.html          La página: solo el contenido (textos, secciones) y los datos para Google del <head>
├── css/
│   └── estilos.css     Todos los estilos, por secciones (índice al principio del archivo)
├── js/
│   ├── main.js         Arranca todo (lo carga index.html)
│   ├── util.js         Herramientas chicas: $, esc, plata, waNum…
│   ├── datos.js        Lee la carta del gestor y las fotos de los platos
│   ├── portada.js      Foto de portada, WhatsApp, Instagram, horarios, formas de pago
│   ├── carta.js        Comida lista (pestañas, destacadas, lista), promo, «para cocinar en casa»
│   ├── google.js       Datos para Google: carta con precios y preguntas frecuentes
│   ├── navegacion.js   Pestañas, menú, encabezado, sección actual, barra del celular
│   └── chat.js         Chat de preguntas  ← GENERADO, no editar acá
├── Imagenes/           Logo, íconos y fotos de la portada (Imagenes/web/)
├── pedir/              La tienda online  ← GENERADA, no editar acá
├── __/                 Archivos de ingreso con Google  ← GENERADOS, no editar acá
├── favicon.ico, site.webmanifest     Íconos de la pestaña y del acceso directo en el celular
├── robots.txt, sitemap.xml           Para Google
├── googlef3ddb63c12f783d2.html       Verificación de Google Search Console (no borrar)
├── CNAME                             Dominio tiendamiru.com para GitHub Pages (no borrar)
└── .nojekyll                         Para que GitHub Pages publique la carpeta __ (no borrar)
```

**Generados:** `pedir/`, `__/` y `js/chat.js` los copia `publicar-web.ps1` desde la carpeta del gestor (`PAG WEB\Gestores`). Si se cambian acá, se pierden en la próxima publicación: la tienda y el chat se editan en `Gestores\public\tienda.html` y `Gestores\public\chat.js`.

## Cómo publicar

Desde la carpeta `PAG WEB\Gestores`:

```
powershell -ExecutionPolicy Bypass -File .\publicar-web.ps1
```

Copia la tienda y el chat, sube los cambios a GitHub y en 1 o 2 minutos se ven en tiendamiru.com.

## Al cambiar algo

- **Textos o secciones:** en `index.html`.
- **Estilos:** en `css/estilos.css`. Los ajustes para celular están todos juntos al final, en «---------- celular».
- **Comportamiento:** en el archivo de `js/` que corresponde (ver arriba).
- **Después de cambiar un CSS o un JS**, subí el número de versión en `index.html` (`estilos.css?v=1` → `?v=2`, `main.js?v=1` → `?v=2`), así los navegadores no siguen usando la versión vieja guardada. Los archivos de `js/` que carga `main.js` se renuevan solos en unos 10 minutos.
- **Probar en la computadora:** los módulos de `js/` no funcionan abriendo `index.html` con doble clic. Abrí una terminal en esta carpeta y corré `npx serve` (o `python -m http.server`), y entrá a la dirección que muestra.

## Archivos viejos

Lo del proyecto anterior (funciones y reglas de tiendamiru-6bdc9, panel admin, video de la portada vieja) quedó en `PAG WEB\_respaldo-web-2026-11-19`, fuera de la web.
