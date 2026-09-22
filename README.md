# Casa Comun

App Next.js para coordinar una casa entre Carlos W, Jorge A y Luis M.

## Desarrollo

```bash
npm install
npm run dev
```

Cuentas demo:

- `carlos` / `Casa123`
- `jorge` / `Casa123`
- `luis` / `Casa123`

## Sincronizacion y notificaciones

La app usa Supabase para compartir las listas y el estado de la casa. Ejecuta `supabase/schema.sql` en el SQL Editor de tu proyecto Supabase.

Configura estas variables en Vercel y en `.env.local`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu-correo@example.com
```

Tambien se acepta `NEXT_PUBLIC_SUPABASE_URL` como nombre alternativo para la URL. No uses la publishable key como `SUPABASE_SERVICE_ROLE_KEY`: son credenciales distintas.

Genera las claves con:

```bash
npx web-push generate-vapid-keys
```

La clave privada debe permanecer solo en Vercel. En iPhone/iPad, el usuario debe agregar la web a la pantalla de inicio antes de activar notificaciones. El cliente consulta el estado cada segundo y las rutas `/api/state` y `/api/push` gestionan la persistencia y los avisos.

## Validacion

```bash
npm run lint
npm run build
```
