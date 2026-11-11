# FemShoes · Tienda online de calzado femenino premium

Tienda online pensada primero para el celular, construida con **Next.js 16** y **Tailwind CSS 4**. Los pedidos se envían por **WhatsApp** y los productos se administran desde un panel privado (`/admin`) conectado a **Supabase**.

## Qué incluye

- **Inicio**: portada, carrusel de categorías, productos destacados y novedades.
- **Tienda** (`/tienda`): filtros por categoría, novedades, ofertas y talla disponible, con orden por precio.
- **Ficha de producto**: galería deslizable, selector de talla con stock, botón fijo "Agregar a la bolsa" y consulta por WhatsApp.
- **Bolsa y pedido**: el carrito se guarda en el teléfono de la clienta. Al finalizar, se arma un mensaje de WhatsApp al +57 300 493 4732 con productos, tallas, total y datos de envío.
- **Panel `/admin`**: crear, editar, ocultar y eliminar productos; subir fotos; inventario por talla; precios con descuento; productos destacados y nuevos.
- Páginas de **guía de tallas** y **envíos y cambios**.

## Usarla en tu computador

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Sin Supabase configurado, la tienda muestra **productos de ejemplo**.

## Personalizar

Los datos generales (nombre, WhatsApp, envío gratis, métodos de pago) están en `src/lib/config.ts`.
La paleta de colores y las tipografías están en `src/app/globals.css`.

## Conectar Supabase (productos reales)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. Abre **SQL Editor**, pega el contenido de `supabase/schema.sql`, **cambia el correo de administradora** y ejecútalo.
3. En **Authentication > Users > Add user**, crea tu usuario con ese mismo correo y una contraseña.
4. En **Authentication > Sign In / Providers**, desactiva "Allow new users to sign up" para que nadie más pueda registrarse.
5. Copia `.env.example` como `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (están en **Project Settings > API**).
6. Entra a `/admin` con tu correo y contraseña para cargar tus productos.

Al conectar Supabase, la tienda deja de mostrar los productos de ejemplo y muestra los que cargues.

## Usuarios y roles del panel

- **Superadmin:** gestiona productos y usuarios. En `/admin → Usuarios` crea cuentas con correo y contraseña inicial, cambia roles y quita accesos.
- **Administrador:** solo gestiona productos.
- Los usuarios se crean en el servidor con la llave de servicio, así que la tienda necesita la variable `SUPABASE_SERVICE_ROLE_KEY` en tiempo de ejecución. No lleva el prefijo `NEXT_PUBLIC` y nunca llega al navegador.
- Siempre debe quedar al menos un superadmin, y nadie puede quitarse su propio rol ni eliminar su propia cuenta.
- Base de datos: después de `schema.sql`, ejecuta `supabase/migrations/002_roles.sql`.

## Despliegue actual (Dokploy)

- **Tienda:** https://femshoes.miguiafinanciero.com — servicio `tienda` en el proyecto `femshoes` de Dokploy. Usa el `Dockerfile` y se vuelve a desplegar sola con cada push a `main`.
- **Supabase (autoalojado):** https://supabase.miguiafinanciero.com — servicio `pre0.22.5-supabase` (plantilla de Dokploy). El usuario y la contraseña de Studio están en sus variables de entorno (`DASHBOARD_USERNAME` y `DASHBOARD_PASSWORD`).
- En Dokploy, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se configuran como **Build-time Arguments**, porque quedan fijadas al compilar.
- Postgres no se publica en el servidor: el puerto 5432 del pooler está cerrado. Para ejecutar SQL usa el editor de Studio.

## Publicar en Vercel

1. Importa este repositorio en [vercel.com](https://vercel.com/new).
2. Agrega las dos variables de entorno de Supabase.
3. Cada cambio que subas a GitHub se publica automáticamente.

## Estructura

```
src/app/(tienda)/      Páginas públicas: inicio, tienda, producto, carrito…
src/app/admin/         Panel de administración
src/components/        Componentes (carrito, tarjetas, galería, panel…)
src/lib/               Configuración, catálogo, Supabase, WhatsApp
supabase/schema.sql    Tablas, seguridad y almacenamiento de fotos
scripts/               Generador de ilustraciones de ejemplo
```
