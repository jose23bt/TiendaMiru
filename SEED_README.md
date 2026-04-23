# Seed de Comida Lista — MIRU

Scripts para cargar / actualizar / borrar los platos de la sección **Comida Lista** en Firestore.

## Archivos

| Archivo | Qué hace |
|---|---|
| `comida-lista.json` | Datos de todos los platos (editable a mano) |
| `seed-comida-lista.js` | Script Node que sube el JSON a Firestore |

## Requisitos (solo la primera vez)

Desde la carpeta del proyecto, instalá la dependencia:

```bash
npm install firebase-admin
```

Y asegurate de estar logueado en Firebase CLI:

```bash
firebase login
```

## Uso

### Cargar / actualizar todos los platos

```bash
node seed-comida-lista.js
```

**Importante:** el script usa un ID generado a partir del nombre del plato.
Esto significa que correrlo varias veces **no duplica** — sobrescribe el plato si ya existe.
Si cambiás un precio o descripción en el JSON y corrés de nuevo, se actualiza.

### Borrar TODOS los platos

```bash
node seed-comida-lista.js --limpiar
```

### Reset completo (borrar todo y volver a cargar)

```bash
node seed-comida-lista.js --reset
```

## Cómo editar el menú

1. Abrí `comida-lista.json` en cualquier editor de texto (VS Code, Notepad++, etc.)
2. Cambiá los valores: `nombre`, `desc`, `precio`, `imagen`, etc.
3. Guardá el archivo
4. Corré `node seed-comida-lista.js`

### Agregar un plato nuevo

Copiá un objeto dentro del array `platos` y editá los valores. Ejemplo:

```json
{
  "nombre": "Pizza Especial de la Casa",
  "categoria": "pizzas",
  "desc": "Descripción del plato",
  "precio": 12000,
  "imagen": "https://url-de-la-imagen.jpg",
  "orden": 9,
  "disponible": true,
  "esVideo": false
}
```

### Eliminar un plato específico

Sacalo del JSON **y** corré `node seed-comida-lista.js --reset` para que se borre de Firestore.
(Alternativa: ir a la Firebase Console y borrar el documento a mano.)

### Usar un video en lugar de una imagen

Poné `"esVideo": true` y en `imagen` la URL del `.mp4`.

### Marcar un plato como "no disponible hoy"

Cambiá `"disponible": true` por `"disponible": false`. El plato sigue apareciendo en la grilla pero con un badge rojo y opacidad reducida.

## Si hay errores de autenticación

Si al correr el script ves un error tipo `UNAUTHENTICATED` o `permission denied`:

1. Andá a [Firebase Console](https://console.firebase.google.com/project/tiendamiru-6bdc9/settings/serviceaccounts/adminsdk)
2. **⚙ Configuración → Cuentas de servicio**
3. Click en **"Generar nueva clave privada"** → descargá el JSON
4. Guardalo en esta carpeta como **`service-account.json`** (exactamente ese nombre)
5. Volvé a correr `node seed-comida-lista.js`

**⚠ NUNCA subas `service-account.json` a GitHub.** Agregalo a `.gitignore`:

```
service-account.json
```
