# MIRU — Tienda de Comida & Bebidas

Tienda online con carrito, pedidos por WhatsApp y panel de administración.

## 📁 Estructura de archivos

```
miru/
├── index.html     → Estructura HTML de la página
├── styles.css     → Todos los estilos y diseño visual
├── app.js         → Toda la lógica (carrito, admin, filtros, WhatsApp)
└── README.md      → Este archivo
```

## 🚀 Cómo usar

Simplemente abrí `index.html` en tu navegador. No necesita servidor ni instalación.

## ⚙️ Configuración inicial

1. Abrí la tienda en el navegador
2. Hacé clic en el botón **Admin**
3. Andá a la pestaña **Configuración**
4. Completá:
   - **Nombre** de tu tienda
   - **WhatsApp** con código de país (ej: `5491112345678`)
   - **Mensaje** inicial del pedido
5. Guardá los cambios

## 🛒 Agregar productos

1. Clic en **Admin** → pestaña **Nuevo producto**
2. Completá nombre, categoría, descripción, precio y emoji
3. Guardá — aparece automáticamente en la tienda

## 🌐 Publicar gratis en internet

### Opción A — Netlify (más fácil, recomendado)
1. Entrá a [netlify.com](https://netlify.com) y creá una cuenta gratis
2. Arrastrá la carpeta `miru/` directo en el panel de Netlify
3. ¡Listo! Te da un link tipo `https://miru-tienda.netlify.app`

### Opción B — GitHub Pages
1. Creá una cuenta en [github.com](https://github.com)
2. Creá un repositorio nuevo
3. Subí los 3 archivos (`index.html`, `styles.css`, `app.js`)
4. En Settings → Pages → seleccioná la rama `main`
5. Tu sitio queda en `https://tuusuario.github.io/miru`

## 💾 Dónde se guardan los datos

Los productos y la configuración se guardan en el **localStorage** del navegador. Esto significa:
- Los datos persisten aunque cierres el navegador
- Son locales a cada dispositivo/navegador
- Para un sistema con base de datos real, se puede integrar con Supabase (gratis)

## 🎨 Personalizar colores

Abrí `styles.css` y editá las variables al comienzo del archivo:

```css
:root {
  --negro:         #0e0c0a;   /* Color principal oscuro */
  --crema:         #f0ead8;   /* Fondo general */
  --rojo:          #c0392b;   /* Color de acento / botones */
  --marron:        #5c3d1e;   /* Bordes y detalles */
  --marron-claro:  #8b6340;   /* Textos secundarios */
  --gris:          #7a7060;   /* Textos suaves */
}
```
