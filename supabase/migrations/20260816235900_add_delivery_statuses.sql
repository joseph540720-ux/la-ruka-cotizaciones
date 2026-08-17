alter table public.cotizaciones drop constraint if exists cotizaciones_delivery_status_check;

alter table public.cotizaciones add constraint cotizaciones_delivery_status_check
  check (delivery_status in (
    'borrador',
    'descargada',
    'compartida',
    'enviada_encargado',
    'enviada_cliente',
    'subida_mercado_publico'
  ));
