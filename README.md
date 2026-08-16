# La Ruka · Cotizaciones

Módulo de cotizaciones de coffee break para el futuro sistema de gestión gastronómica de La Ruka.

## Ejecutar

```powershell
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Funciones disponibles

- Datos configurables del negocio y carga del logo real.
- Catálogo agrupado por categorías, con creación, edición y activación.
- Clientes reutilizables, editables y creación dentro de la cotización.
- Cálculo determinístico de neto, IVA 19 %, total, costo y utilidad.
- Vista previa y descarga real del PDF con el logo de La Ruka.
- Historial, detalle y duplicación de cotizaciones.
- Eliminación de cotizaciones con confirmación explícita.
- Separación entre total cotizado y total facturado.
- Registro de número, fecha y monto de factura, incluso parcial.
- Acceso privado y sincronización en Supabase cuando se configura.
- Interfaz responsive para computador y teléfono.
- Aplicación web instalable en la pantalla de inicio del celular.

## Activar acceso y sincronización

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` desde el editor SQL del proyecto.
3. Copiar `.env.example` como `.env.local`.
4. Completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Reiniciar la aplicación y crear el acceso privado de La Ruka.

Las políticas incluidas aíslan los datos por cuenta autenticada.

## Activar el envío por correo

1. Copiar `.env.example` como `.env.local`.
2. Completar `RESEND_API_KEY`.
3. Completar `RESEND_FROM_EMAIL` con un dominio verificado.
4. Reiniciar la aplicación.

La dirección receptora se configura desde **Mi negocio**.

## Verificación

```powershell
npm run lint
npm test
npm run build
```

Si Supabase no está configurado, la aplicación conserva un modo local para desarrollo. Para compartirla entre celular y computador se debe usar la configuración en nube.
