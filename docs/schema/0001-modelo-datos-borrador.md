# Borrador: Modelo de Datos Inicial (Supabase/Postgres)

**Status:** Confirmado con el usuario — listo para pasar a migración SQL
**Date:** 2026-09-09
**Depende de:** [ADR-0002](../adr/0002-confirmacion-stack-vercel-supabase.md)

## Principio rector

Solo se ingestan como tablas las hojas del Excel que son **fuente cruda** (exportes directos de Novasoft). Las hojas que ya son tablas dinámicas/calculadas en Excel (`Materiales`, `Inyeccion`, `7. Pedidos`, `8. Resumen general Tiempo`, `td. kardex`) **no se ingestan** — el motor de balance de la app las recalcula a partir de las tablas fuente, reproduciendo la fórmula de `archivo-inicial.md` sección 4.2:

```
Balance = (Kardex + Programado/En Tránsito) − (Necesidad por Pedidos + Stock de Seguridad)
```

## Confirmado con el usuario (2026-09-09)

- Clasificación por prefijo de código de bodega/item:
  - `10` = Materia Prima (insumo para producir ítems de bodega `20`)
  - `20` = En Proceso / semi-terminado
  - `30` = Producto Terminado (para venta)
  - `50` = Empaque complementario ya listo (etiquetas, bolsas, etc.)
  - `90` = **Tiempo** — indicador especial, no es inventario físico. Aparece como "matpri" dentro del BOM para representar minutos estándar de mano de obra por unidad producida.
- BOM: `fichas` = SKU/receta padre, `matpri` = insumo o tiempo consumido, `cantidad` = consumo unitario. Relación 1 ficha → N matpri.

> ✅ **Resuelto (2026-09-09):** al correr el parser contra el Excel real apareció que la columna `bod` de "1. Listado de productos" no usa `50`/`90` como se había dicho, sino `15`/`99` — y hay además `40`, `A0`, `B0`, `Z` sin describir (~28% del catálogo). Confirmado con el usuario:
>
> | Código real `bod` | Categoría | Notas |
> |---|---|---|
> | `10` | `materia_prima` | (sin cambios) |
> | `20` | `en_proceso` | (sin cambios) |
> | `30` | `producto_terminado` | (sin cambios) |
> | `15` | `empaque_complementario` | **corrige** la suposición inicial de `50` |
> | `B0` | `empaque_complementario` | código adicional para la misma categoría |
> | `99` | `tiempo` | **corrige** la suposición inicial de `90` |
> | `A0` | _(excluido)_ | servicios/gastos (arriendo, transporte) — no es inventario, se omite en la ingesta sin reportarlo como error |
> | `40`, `Z` | _(sin clasificar, fuera de alcance por ahora)_ | 1 y 2 filas respectivamente — el usuario indicó que no son relevantes por ahora; el parser los deja como fila con error (no se pierden, solo no se cargan) |
>
> `lib/ingestion/productos.ts` ya implementa esta tabla. `50` y `90` se dejan también mapeados a las mismas categorías por si algún archivo futuro los usa.
- `Stock Semanal` = objetivo de tener ~2 semanas de stock en bodega; se cruza junto con los pedidos reales de clientes para la necesidad total (no es inventario, es demanda adicional).
- Capacidad de Mano de Obra (`Resumen general Tiempo`) — **fuera de alcance por ahora**, se agrega en una iteración posterior.
- `ficha_code` (formato `NNNN-NNN-NN`) es un espacio de numeración **propio e independiente** del catálogo `productos` (formato `NNNN-NNNNNN`) — no vive en `Listado de productos`. Requiere su propia tabla maestra.
- Kardex: se guarda **solo el snapshot más reciente** por ítem/bodega (no histórico día a día). El log de `cargas` deja trazabilidad de cuándo se actualizó.

## Tablas propuestas (fuentes crudas)

### `productos`
Maestro de ítems (de `1. Listado de productos`).
| Columna | Origen | Notas |
|---|---|---|
| `item_code` (PK/unique) | `item` | Código Novasoft, ej. `1001-000001` |
| `cod_alt` | `cod_alt` | Código alterno interno |
| `nombre` | `nombre` | |
| `upc` | `upc` | Nullable |
| `bodega_base` | `bod` | `10`/`20`/`30`/`50`/`90` |
| `categoria` | derivado de `bodega_base` | `materia_prima` \| `en_proceso` \| `producto_terminado` \| `empaque_complementario` \| `tiempo` |
| `estado` | `estado` | Activo/inactivo |

### `fichas`
Maestro de fichas/piezas producidas (código formato `NNNN-NNN-NN`, ej. `2001-001-01`, `3003-007-01`). **Confirmado: es un espacio de códigos propio, independiente del catálogo de `productos`** (que usa formato `NNNN-NNNNNN` para insumos de bodega). Se alimenta de los valores distintos de `fichas`/`codpt`/`item` vistos en `Boom_Materiales`, `Materiales`, `Inyeccion` y `En proceso Inyeccion`.
| Columna | Origen | Notas |
|---|---|---|
| `ficha_code` (PK/unique) | `fichas` / `codpt` | |
| `nombre` | `Nombre2` / `nombre` (según la hoja donde aparezca primero) | |
| `alterno` | `Alterno` | |
| `estado` | `estado` (Boom_Materiales) | |

### `bom_items`
BOM/receta (de `3.Boom_Materiales`, solo columnas A:L — el resto de la hoja es un bloque de tabla dinámica pegado al lado, se ignora).
| Columna | Origen | Notas |
|---|---|---|
| `ficha_code` | `fichas` | FK a `fichas.ficha_code` |
| `matpri_code` | `matpri` | FK a `productos.item_code` — insumo o pseudo-material de tiempo consumido |
| `cantidad` | `cantidad` | Consumo unitario |
| `etapa` | `etapa` | `INY`, `EMPAQUE`, etc. |
| `unidad_medida` | `expr_01` | |
| `es_tiempo` | derivado | `true` si `matpri_code` pertenece a bodega `90` |
| `fecha_actualizacion` | `fecact` | Serial de Excel → fecha real |

### `kardex_existencias`
Existencias por bodega (de `4. Kardex NS diario`). Solo se conserva el snapshot más reciente por `item_code`+`cod_bodega` (upsert en cada carga) — sin histórico día a día por ahora.
| Columna | Origen |
|---|---|
| `item_code` | dato de la fila (columna con formato item, pese al header `acum`) |
| `cod_bodega` | `cod_bod` |
| `anio` | `ano_acu` |
| `existencia` | `t_exis` |
| `valor_total` | `vr_tot` |
| `carga_id` | FK a `cargas` |

### `pedidos`
Pedidos reales de clientes (de `5. Pedidos_Novasoft`).
| Columna | Origen |
|---|---|
| `numero_pedido` | `numero` |
| `fecha`, `fecha_entrega` | `fecha`, `fecha_ent` |
| `cliente_nit`, `cliente_nombre` | `nit_clie`, `Nombre cliente` |
| `item_code` | `item` |
| `bodega` | `bodega` |
| `cantidad` | `cantidad` |
| `sem1..sem4` | `sem1..sem4` |
| `dia_malla`, `fecha_corte` | `Dia Malla`, `fec_corte` |
| `estado_pedido` | `Estado pedido` |
| `carga_id` | FK a `cargas` |

`item_code` debería apuntar normalmente a `productos.item_code` (bodega `30`, producto terminado). Algunas filas del export traen códigos que no son producto (ej. servicios de flete/exportación) — el validador de carga debe tolerarlas sin romper el resto de la fila (requisito de "cargas parciales" de `archivo-inicial.md` sección 4.1), marcándolas como advertencia en vez de descartarlas.

### `demanda_stock_seguridad`
Objetivo de stock (de `6. Stock Semanal`). Mismo shape que pedidos pero **no es un pedido real** — se marca como línea de demanda de tipo `stock_seguridad`.
| Columna | Origen |
|---|---|
| `item_code` | `item` |
| `bodega` | `bodega` |
| `cantidad_objetivo` | `cantidad` |
| `carga_id` | FK a `cargas` |

### `ordenes_produccion_inyeccion`
Órdenes de inyección en curso (de `En proceso Inyeccion`).
| Columna | Origen |
|---|---|
| `numero_orden`, `num_proceso` | `numero`, `num_pro` |
| `ficha_code` | `codpt` — FK a `fichas.ficha_code` |
| `cantidad_programada`, `cantidad_entregada` | `canprod`, `can_ent` |
| `maquina_inyectora` | `Inyectora` |
| `estado` | `Estado` |
| `tiempo_unitario`, `total_tiempo`, `total_horas` | `Tiempo`, `Total tiempo`, `Total Horas` |
| `carga_id` | FK a `cargas` |

### `mallas_clientes`
Referencia de rutas/zonas (de `2. Listado de mallas`).
| Columna | Origen |
|---|---|
| `nit_cliente` | `Nit cliente` |
| `nombre_cliente_principal` | `Nombre cliente principal` |
| `nombre_punto` | `Nombre puntos` |
| `zona`, `nombre_zona` | `zona`, `Nombre zona` |
| `ciudad` | `Nombre ciudad` |
| `dia_despacho`, `dia_malla` | `DIA DE DESPACHO`, `DIA DE MALLA` |

### `cargas`
Log de ingestas — respalda la pantalla "Carga de Datos" del mockup, incluyendo cargas parciales con errores.
| Columna | Notas |
|---|---|
| `tipo_reporte` | Kardex / Pedidos / BOM / Productos / Stock Semanal / En Proceso Inyección / Mallas |
| `archivo_nombre`, `archivo_storage_path` | Referencia al archivo en Supabase Storage |
| `usuario_id` | FK a `auth.users` de Supabase |
| `filas_totales`, `filas_exitosas`, `filas_error` | |
| `estado` | success / warning / error |
| `detalle_errores` | `jsonb`: `[{fila, motivo}]` |

## No son tablas — se calculan en la app

`Materiales`, `Inyeccion`, `7. Pedidos`, `8. Resumen general Tiempo`, `td. kardex` → se reemplazan por queries/vistas del motor de balance sobre las tablas de arriba.

## Siguiente paso

Con esto ya no quedan preguntas bloqueantes para una primera migración. El siguiente paso natural es: escafoldar el proyecto Next.js + Supabase (ADR-0002) y traducir estas tablas a un esquema real de Drizzle + migración SQL, empezando por `productos`, `fichas`, `bom_items` y `cargas` (lo mínimo para que la pantalla de "Carga de Datos" del mockup funcione con Kardex/Productos/BOM), y sumando `pedidos`, `demanda_stock_seguridad`, `ordenes_produccion_inyeccion` y `mallas_clientes` en una segunda pasada.
