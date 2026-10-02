# Borrador: Modelo de Datos Inicial (Supabase/Postgres)

**Status:** Confirmado con el usuario — listo para pasar a migración SQL
**Date:** 2026-09-09
**Depende de:** [ADR-0002](../adr/0002-confirmacion-stack-vercel-supabase.md)

## Estrategia de actualización por carga (confirmado 2026-09-10)

Cada tabla se comporta distinto cuando se sube un Excel nuevo del mismo tipo:

- **`productos`** (catálogo): **upsert** por `item_code`. Un item existente se actualiza; uno nuevo se inserta. Nunca se borra nada — el catálogo es acumulativo, no una foto de un momento.
- **`kardex_existencias`, `bom_items`, `pedidos`, `demanda_stock_seguridad`, `ordenes_produccion_inyeccion`, `mallas_clientes`**: cada una representa una **foto del estado actual** en el Excel de Novasoft (existencias de hoy, pedidos pendientes de hoy, etc.), no un histórico a acumular. Por eso, subir un Excel nuevo de ese tipo **reemplaza por completo** lo que había antes en esa tabla (borra todo lo anterior de esa tabla e inserta las filas nuevas), en vez de hacer upsert fila por fila. Así no quedan "fantasmas" de pedidos ya despachados o existencias desactualizadas.
  - Excepción de seguridad: si el archivo no produce ninguna fila válida (ej. se subió la hoja equivocada), **no se borra nada** — se aborta la carga y se conserva la data anterior, para no perder información por un archivo corrupto o mal seleccionado.
  - El histórico de *qué se cargó y cuándo* no se pierde: eso vive en `cargas`, que siempre acumula (nunca se reemplaza).

✅ **Implementado y probado contra Supabase real (2026-09-10):** las 7 tablas fuente (`productos`, `kardex_existencias`, `bom_items`, `pedidos`, `demanda_stock_seguridad`, `ordenes_produccion_inyeccion`, `mallas_clientes`) tienen su parser en `lib/ingestion/` y su handler en `app/api/ingest/route.ts`, con la estrategia de arriba ya aplicada. Se detectó y corrigió un problema de rendimiento en el camino: reintentar un lote fallido fila por fila era muy lento (41s para ~1,200 filas); se cambió a partir el lote a la mitad recursivamente para aislar solo las filas problemáticas (`lib/db/bulk-insert.ts`).

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
- Kardex: se guarda **solo el snapshot más reciente** por ítem/bodega (no histórico día a día). El log de `cargas` deja trazabilidad de cuándo se actualizó.

> ⚠️ **Corrección importante (2026-09-10):** la suposición de que `ficha_code` era un espacio de numeración independiente de `productos` (fila anterior de este documento) **resultó ser incorrecta** al verificarla contra los datos reales ya cargados. Se comprobó que el 100% de las 1,015 fichas del BOM ya existen como fila en `productos` con el mismo código exacto (480 son `producto_terminado`, 529 `en_proceso`, 6 `materia_prima`). No son dos catálogos — es el mismo código visto desde dos hojas distintas del Excel: una vez como ítem de inventario, otra vez como encabezado de receta.
>
> Confirmado con el usuario: **no existe tabla `fichas` separada.** Un producto es el resultado de otros productos (`bom_items.matpri_code`) más tiempo (`bom_items.es_tiempo`) — por eso `bom_items.ficha_code` también referencia `productos.item_code`: es la misma tabla vista dos veces (padre construido / insumo consumido).
>
> Esto también reveló que el BOM es **multinivel**: 482 de los 1,015 productos con receta son a la vez insumo de otro producto (ej. una pieza inyectada que luego se ensambla en el producto final). El motor de balance debe explotar la receta recursivamente (no solo un nivel) para llegar de la demanda de producto terminado hasta la necesidad real de materia prima y tiempo.
>
> La tabla `fichas` se eliminó de Supabase (`DROP TABLE fichas`, con las FK de `bom_items` y `ordenes_produccion_inyeccion` repuntadas a `productos.item_code`) sin pérdida de datos — se verificó que los datos ya cargados seguían satisfaciendo las nuevas FK.

> ⚠️ **Corrección importante (2026-09-12):** el usuario confirmó que **solo 5 archivos vienen realmente de Novasoft**: Listado de productos, Listado de mallas, BOM materiales, Kardex diario y Pedidos_Novasoft. `Stock Semanal` y `En proceso Inyeccion` (descritos abajo en "Tablas propuestas") **no existen como export real** — eran solo referencia del archivo consolidado inicial. Se eliminaron las tablas `demanda_stock_seguridad` y `ordenes_produccion_inyeccion`, sus parsers y su ruta de carga; el motor de balance ahora deriva ambos conceptos cruzando los 5 archivos reales (ver `docs/BLUEPRINT.md` §8). El resto de esta sección se deja como registro histórico de la hipótesis original.

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

### `bom_items`
BOM/receta (de `3.Boom_Materiales`, solo columnas A:L — el resto de la hoja es un bloque de tabla dinámica pegado al lado, se ignora). No existe tabla `fichas` separada — ver corrección arriba.
| Columna | Origen | Notas |
|---|---|---|
| `ficha_code` | `fichas` | FK a **`productos.item_code`** — el producto que resulta de esta receta |
| `matpri_code` | `matpri` | FK a `productos.item_code` — insumo o pseudo-material de tiempo consumido |
| `cantidad` | `cantidad` | Consumo unitario |
| `etapa` | `etapa` | `INY`, `EMPAQUE`, y otros códigos de etapa/proceso |
| `unidad_medida` | `expr_01` | |
| `es_tiempo` | derivado | `true` si `matpri_code` es categoría `tiempo` (bodega `99`) en `productos` |
| `estado` | `estado` | |
| `fecha_actualizacion` | `fecact` | Serial de Excel → fecha real |

Es **multinivel**: `matpri_code` de una fila puede ser a la vez `ficha_code` de otra (un producto intermedio usado como insumo de otro). El motor de balance debe explotar la receta recursivamente.

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
| `ficha_code` | `codpt` — FK a **`productos.item_code`** |
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

Las 8 tablas (sin `fichas`, ver corrección arriba) están creadas en Supabase y las 7 fuentes crudas ya tienen su ingesta implementada y probada con el Excel real. Siguiente paso: motor de balance (§8 de `docs/BLUEPRINT.md`), con explosión recursiva de `bom_items` dado que es multinivel.
