# Blueprint del Proyecto: ProPlan — Planeación de Producción

**Status:** Especificación consolidada, previa a inicio de construcción
**Date:** 2026-09-09
**Fuentes:** [archivo-inicial.md](reference/archivo-inicial.md), [proplan_manufactura.tsx](reference/proplan_manufactura.tsx), [Maestro_Planeacion Julio.xlsx](reference/Maestro_Planeacion%20Julio.xlsx), [ADR-0001](adr/0001-stack-tecnologico.md), [ADR-0002](adr/0002-confirmacion-stack-vercel-supabase.md), [Modelo de datos](schema/0001-modelo-datos-borrador.md)

Este documento consolida **todo lo decidido hasta ahora** en un solo lugar. Los ADRs y el documento de esquema siguen siendo la fuente de la justificación detallada de cada decisión; este blueprint es la referencia rápida y completa para empezar a construir.

---

## 1. Resumen Ejecutivo

**ProPlan** reemplaza el proceso actual de planeación de producción — hoy basado en un Excel extremadamente denso (`Maestro_Planeacion Julio.xlsx`, 14 hojas, con Power Query y Power Pivot ya montados a mano) — por una aplicación web que:

1. Ingesta los reportes que hoy se exportan manualmente del ERP **Novasoft**.
2. Cruza automáticamente Catálogo, Kardex (inventario), BOM (lista de materiales) y Pedidos.
3. Muestra en tiempo real qué insumos faltan por comprar, qué piezas plásticas faltan por inyectar, y (en una fase posterior) si la capacidad de mano de obra alcanza.

**Fase actual (MVP):** solo ingesta por **carga manual de archivos Excel**. No hay integración directa con la base de datos/API de Novasoft — eso se evaluará cuando el usuario lo confirme.

---

## 2. Negocio: Problema, Valor y Usuarios

### 2.1 Problema
- Planeación hoy se hace en Excel muy pesado → riesgo de error humano en cruces de datos, retrasos en decisiones, sin visibilidad en tiempo real para gerencia/compras.

### 2.2 Solución
- Automatizar la ingesta de datos del ERP y hacer los cruces algorítmicos al instante, determinando:
  1. Qué insumos de empaque faltan por comprar (y cuándo).
  2. Qué piezas plásticas se necesitan inyectar para cumplir la demanda.
  3. (Fase posterior) Si la capacidad de mano de obra alcanza para la semana.

### 2.3 Usuarios y Roles
| Rol | Uso |
|---|---|
| **Planeación** | Uso operativo intensivo: revisión de balances, programación |
| **Compras** | Visualiza alertas de déficit de insumos para emitir OC |
| **Gerencia** | KPIs de cumplimiento, capacidad, predicción de demanda |
| **Administrador** | Configuración de umbrales, roles, estado de integración |

El mockup ya modela estos 4 roles como un selector en el header (no hay lógica de permisos aún — se implementa con Supabase Auth + RLS, ver §4).

---

## 3. Alcance de esta Fase

### ✅ Incluido ahora
- Carga manual de archivos Excel (Productos, BOM, Kardex, Pedidos, Stock Semanal, En Proceso Inyección, Mallas).
- Validación de carga tolerante a errores: si una fila viene mal, se reporta y se descarta esa fila, sin cancelar el resto (carga parcial).
- Motor de Balance para **Insumos** (Necesidad de Compra) y **Piezas** (Necesidad de Inyección).
- Dashboard, pantallas de Necesidad de Compra, Necesidad de Inyección, Pedidos y Clientes.
- Roles y autenticación básicos.

### ⏸️ Diferido a una iteración posterior (ya decidido con el usuario)
- **Capacidad de Mano de Obra** (hoja `Resumen general Tiempo` — layout aún no modelado).
- **Predicción de Demanda** con estadística (móvil/regresión simple en TypeScript, no ML pesado).
- **Análisis Dinámico (BI)** con constructor drag & drop.

### ❌ Fuera de alcance / no confirmado
- Integración directa a la base de datos o API de Novasoft (sin fecha confirmada). El punto de ingesta se aísla en código para que, cuando exista, sólo cambie *cómo entran los datos*.
- ML avanzado para forecasting (Prophet/ARIMA) — solo si en el futuro se necesita más que una proyección estadística simple; en ese caso se evaluaría un microservicio Python aislado, sin tocar el monolito.

---

## 4. Arquitectura Técnica

> Detalle y justificación completa en [ADR-0001](adr/0001-stack-tecnologico.md) (superseded en la parte de backend/frontend) y [ADR-0002](adr/0002-confirmacion-stack-vercel-supabase.md) (vigente).

**Monolito bien estructurado, un solo repo, un solo deploy.**

| Capa | Elección | Notas |
|---|---|---|
| Frontend + Backend | **Next.js (App Router) + TypeScript** | UI en páginas/rutas; lógica de servidor en Route Handlers / Server Actions |
| Despliegue | **Vercel** | `git push` → deploy. Vigilar `maxDuration` de las funciones si los Excel crecen mucho (hoy no es un problema: cientos a ~5,000 filas por hoja) |
| Base de datos | **Supabase (PostgreSQL)** | |
| ORM / Migraciones | **Drizzle ORM + drizzle-kit** | Preferido sobre Prisma por queries más explícitas (útil para el motor de balance) y mejor comportamiento serverless |
| Auth | **Supabase Auth + Row Level Security (RLS)** | Roles: Planeación, Compras, Gerencia, Administrador, aplicados como políticas de RLS en Postgres |
| Almacenamiento de archivos | **Supabase Storage** | Guarda el Excel original de cada carga (trazabilidad) |
| Parseo de Excel | **exceljs** (servidor) | Lee solo las hojas fuente crudas (§6); ignora hojas ya calculadas/pivot |
| UI | Tailwind CSS + shadcn/ui + Recharts + TanStack Query + Zustand + dnd-kit | Ya validado contra el mockup — mismas librerías que usa `proplan_manufactura.tsx` (Recharts, lucide-react) |

**Por qué Node/Next.js y no Python (decisión revisada):** el ADR original (ADR-0001) favorecía Python/FastAPI por el ecosistema de datos (`pandas`) y de ML para forecasting. Al confirmarse Vercel + Supabase + monolito (ADR-0002), ese argumento queda superado: Vercel es hábitat nativo de Node/Next.js, y meter Python habría significado un segundo servicio desplegado aparte — justo lo contrario de "monolito bien estructurado". El forecasting se hace con métodos estadísticos simples en TypeScript por ahora.

### 4.1 Estructura de carpetas propuesta (inicial, sujeta a ajuste)

```
/app
  /(dashboard)
    /dashboard              → Dashboard Principal
    /upload                 → Carga de Datos
    /purchasing             → Necesidad de Compra (Insumos)
    /injection              → Necesidad de Inyección (Piezas)
    /orders                 → Pedidos y Clientes
    /prediction             → Predicción de Demanda (fase posterior)
    /dynamic-analysis       → Análisis Dinámico BI (fase posterior)
    /labor                  → Capacidad Mano de Obra (fase posterior)
    /admin                  → Administración
  /api
    /ingest/[tipo]/route.ts → Endpoint de carga de Excel por tipo de reporte
/lib
  /ingestion/               → Un parser por hoja fuente (productos, bom, kardex, pedidos, ...)
  /balance/                 → Motor de Balance (cálculo de Necesidad de Compra / Inyección)
  /db/                      → Cliente Drizzle + esquema
  /auth/                    → Helpers de Supabase Auth / roles
/drizzle                    → Migraciones SQL generadas
/components                 → UI compartida (KPICard, StatusBadge, Drawer, etc. — ya prototipados en el mockup)
```

---

## 5. Sistema de Diseño (UI/UX)

> Ya implementado como mockup funcional en [proplan_manufactura.tsx](reference/proplan_manufactura.tsx) — el frontend de producción lo traduce a Next.js casi tal cual, no lo reinventa.

- **Estilo:** industrial/dashboard, denso en datos sin abrumar. Referencia: Power BI, Tableau, MES modernos. No es una app "lúdica".
- **Layout:** sidebar fijo izquierdo + lienzo principal scrolleable con Cards.
- **Código de colores semántico** (consistente en toda la app):
  - 🔴 Rojo — Crítico/Déficit: faltante inminente, pedido en riesgo.
  - 🟡 Ámbar — Advertencia: cerca del límite, validación de carga con errores.
  - 🟢 Verde — Ok/Cubierto: inventario sano, capacidad suficiente.
  - 🔵 Azules/Grises — Base corporativa (Slate-800, Slate-50, Indigo-600).
- **Drawers:** clic en una fila de tabla abre un panel lateral con detalle/historial/BOM, sin cambiar de página (mantiene contexto).
- **Drag & Drop:** en el módulo de Carga de Datos (subir archivo) y en el constructor del módulo BI (fase posterior).

---

## 6. Modelo de Datos

> Detalle completo, columna por columna, en [docs/schema/0001-modelo-datos-borrador.md](schema/0001-modelo-datos-borrador.md). Resumen aquí.

### 6.1 Principio rector
Solo se ingestan como tablas las hojas del Excel que son **fuente cruda** (export directo de Novasoft). Las hojas que ya son tablas dinámicas/calculadas en el Excel actual **no se ingestan** — el motor de balance las recalcula desde las tablas fuente:

```
Balance = Kardex − (Necesidad por Pedidos + Stock de Seguridad derivado)
```

**Confirmado con el usuario (2026-09-12): solo 5 archivos vienen realmente de Novasoft** — Listado de productos, Listado de mallas, BOM materiales, Kardex diario y Pedidos. No existen archivos separados de "Stock de Seguridad" ni "Órdenes en Proceso de Inyección" — esos dos ya no se ingestan; se derivan cruzando los 5 reales (ver §6.4 y §8).

### 6.2 Clasificación de ítems (confirmado con el usuario, y verificado contra el Excel real)
El código de bodega determina la categoría. La primera versión asumía `10/20/30/50/90`; al implementar el parser contra el archivo real se corrigió a `10/20/30/15/99` (ver detalle en [docs/schema/0001-modelo-datos-borrador.md](schema/0001-modelo-datos-borrador.md)):

| Código real | Categoría |
|---|---|
| `10` | Materia Prima (insumo para producir ítems de bodega `20`) |
| `20` | En Proceso / semi-terminado |
| `30` | Producto Terminado (para venta) |
| `15`, `B0` | Empaque complementario ya listo (etiquetas, bolsas, etc.) |
| `99` | **Tiempo** — no es inventario físico; dentro del BOM representa minutos estándar de mano de obra codificados como si fueran un material |
| `A0` | Servicios/gastos (arriendo, transporte) — no es inventario, se excluye de la ingesta |

### 6.3 Un producto es el resultado de otros productos + tiempo (corregido 2026-09-10)
La hipótesis inicial era que `fichas.ficha_code` (formato `NNNN-NNN-NN`) vivía en un espacio de códigos separado de `productos.item_code`. **Se comprobó contra los datos reales que esto era incorrecto:** el 100% de las 1,015 fichas del BOM ya existen como fila en `productos` con el mismo código — no son dos catálogos, es el mismo código visto desde dos hojas del Excel (una vez como ítem de inventario, otra vez como encabezado de receta).

No existe tabla `fichas` separada. El modelo real es más simple y más correcto: **un producto es el resultado de otros productos, más tiempo.** `bom_items.ficha_code` (el producto construido) y `bom_items.matpri_code` (lo que consume — material o tiempo) referencian ambos `productos.item_code`. Esto además reveló que el BOM es **multinivel**: 482 de los 1,015 productos con receta son a la vez insumo de otro producto (ej. una pieza inyectada que luego se ensambla en el producto final) — el motor de balance (§8) explota la receta recursivamente.

### 6.4 Tablas (fuentes crudas a ingestar)

| Tabla | Hoja Excel origen | Contenido |
|---|---|---|
| `productos` | `1. Listado de productos` | Catálogo maestro de ítems |
| `bom_items` | `3.Boom_Materiales` (solo cols A:L) | Receta: `ficha_code` → `matpri_code` × `cantidad` (ambos referencian `productos.item_code`); `es_tiempo=true` si `matpri_code` es categoría `tiempo` (bodega `99`) |
| `kardex_existencias` | `4. Kardex NS diario` | Snapshot de existencias (solo el más reciente, sin histórico diario) |
| `pedidos` | `5. Pedidos_Novasoft` | Pedidos reales de clientes |
| `mallas_clientes` | `2. Listado de mallas` | Referencia de rutas/zonas de despacho por cliente |
| `cargas` | — | Log de cada ingesta: archivo, usuario, filas OK/error, detalle de errores (`jsonb`) |

No vienen del Excel, son configuración de la app (§10, pasos 5-6):

| Tabla | Contenido |
|---|---|
| `configuracion` | Clave/valor genérico — hoy solo `umbral_advertencia_pct` |
| `capacidad_mano_obra` | Disponibilidad de mano de obra por día, configurada a mano (`/labor`) |
| `demanda_historica_mensual` | Histórico real de demanda mensual, acumulado a partir de `pedidos` en cada carga (§12.1) |
| `reportes_guardados` | Reportes guardados del constructor de Análisis Dinámico (§12.2) |

### 6.5 No son tablas — se calculan en la app
`Materiales`, `Inyeccion`, `7. Pedidos`, `8. Resumen general Tiempo`, `td. kardex` → reemplazadas por queries del motor de balance sobre las tablas de arriba.

Desde 2026-09-12, tampoco lo son `demanda_stock_seguridad` ni `ordenes_produccion_inyeccion` (se eliminaron esas tablas y sus parsers/rutas de carga) — ver §8 para cómo se derivan ahora del cruce de Pedidos y Kardex.

### 6.6 Hojas descartadas
`Hoja1`, `Hc cumpleaños` — no relevantes para el sistema.

### 6.7 Dos formatos de entrada: "pivot" y "plano" (2026-09-11)
El archivo de referencia inicial del proyecto era una tabla dinámica ya
consolidada a mano (una hoja con nombre y encabezados por reporte). Los
archivos que exporta Novasoft directamente (botón de exportar del ERP) vienen
crudos: un `.XLS` binario clásico (formato BIFF, aunque a veces con extensión
`.xlsx`) de una sola hoja `sheet1`, sin fila de encabezados y con columnas en
blanco intercaladas. `ExcelJS` no puede leer BIFF en absoluto (de ahí el
error "Corrupted zip" al subir un `.XLS` real); se usa `xlsx` (SheetJS) para
ambos formatos.

`productos.ts`, `bom.ts` y `kardex.ts` detectan automáticamente cuál llegó
(buscan la hoja con nombre conocido; si no existe, asumen formato plano y
usan posiciones de columna fijas confirmadas contra archivos reales) — el
usuario no tiene que elegir un tipo de archivo distinto, solo el mismo
selector de reporte de siempre. El formato plano no trae todos los campos del
pivot (BOM sin `etapa`/`estado`/`fecha_actualizacion`; Kardex sin
`valor_total`, con `año` derivado de la fecha) — quedan `null`, es esperado.

`pedidos.ts` también detecta el formato plano (2026-10-02): reporte Novasoft
`FAC0015 PED PEND X SEMANAS DETALLE`, agrupado por producto (fila de producto
`CODIGO-NOMBRE`, líneas de pedido con fecha de entrega, pedido, cliente y
cantidades en columnas "vencido" + 4 semanas, y una fila de subtotal por
producto que se ignora). Verificado contra `FAC0015_JOSE.XLS`: 126 productos,
1285 líneas, 0 errores, subtotales coinciden. **No trae fecha del pedido, NIT
ni bodega** — consecuencias: (a) el cruce con Mallas cae a coincidencia por
nombre de cliente (`lib/orders/queries.ts`, ~50% de clientes coinciden);
(b) el motor de balance usa `fecha_entrega` como respaldo para el rango de
semanas del stock de seguridad (`lib/balance/engine.ts`); (c) como `fecha` queda
null, esta carga ya no suma meses al histórico de Predicción de Demanda.
`mallas.ts` todavía solo soporta el formato pivot.

---

## 7. Módulos y Pantallas (del mockup)

| Pantalla | Función | Fase |
|---|---|---|
| **Dashboard Principal** | KPIs (faltante capacidad, insumos/piezas en déficit, pedidos pendientes, última carga) + gráfico Necesidad vs Capacidad + alertas críticas | MVP |
| **Carga de Datos** | Selector de tipo de reporte, drag & drop de Excel, validación con cargas parciales, historial de cargas | MVP |
| **Nec. Compra (Insumos)** | Tabla de insumos con stock/necesidad/balance, búsqueda, filtros, exportar, drawer de detalle | MVP |
| **Nec. Inyección (Piezas)** | Tabla de piezas con necesidad/kardex/balance, drawer de detalle | MVP |
| **Pedidos y Clientes** | Tabla de pedidos con estado, zona/malla de despacho | MVP |
| **Capacidad Mano de Obra** | Tarjetas por día: necesidad vs disponible vs balance | Fase posterior |
| **Predicción Demanda** | Gráfico venta real vs proyección | ✅ Implementado (2026-09-12) |
| **Análisis Dinámico (BI)** | Constructor de dimensiones/medidas (clic, no drag&drop), reportes guardados | ✅ Implementado (2026-09-12) |
| **Administración** | Umbrales de déficit crítico, estado de integración ERP, roles | MVP (básico) |

Patrón transversal: clic en cualquier fila abre un **Drawer** con detalle, histórico y acción sugerida (ej. "Generar Solicitud" de compra) — no navega a otra página.

---

## 8. Motor de Balance (lógica core) — ✅ implementado y probado (2026-09-10)

`lib/balance/engine.ts` (`computeBalance()`) hace una explosión de BOM **multinivel** en memoria (no una CTE recursiva en SQL — las tablas son de a lo sumo unos pocos miles de filas, así que traerlas completas y explotar en JS es simple y rápido: ~1 segundo para todo el cálculo real). Es el algoritmo MRP clásico, con "netting" en cada nivel:

```
Para cada ítem demandado (nivel 0 = pedidos + stock de seguridad derivado):
  neto = max(0, demanda_bruta − kardex)
  si neto > 0 y el ítem tiene receta (bom_items):
    explota "neto" hacia cada insumo/tiempo de la receta (multiplicado por la cantidad de la receta)
    → eso se vuelve la demanda_bruta del siguiente nivel
```

El "netting" por nivel es clave: si ya hay 500 unidades de una pieza intermedia en kardex, esas 500 NO generan necesidad de materia prima — solo el faltante real se sigue explotando hacia abajo. Un mismo ítem puede recibir demanda desde varias ramas (el BOM es un grafo, no un árbol) — se acumula la demanda bruta y solo se re-explota el incremento neto, no el neto completo de nuevo.

**Rediseño 2026-09-12 — solo 5 archivos reales de Novasoft:** el usuario confirmó que "Stock de Seguridad" y "Órdenes en Proceso de Inyección" nunca existieron como export real (no había forma de subirlos ya adecuadamente probada, eran solo tablas de referencia inicial) — se eliminaron esas dos tablas, sus parsers y su ruta de carga. Ahora se derivan cruzando los 5 archivos reales:
- **Producción en proceso:** se dejó de netear aparte. La existencia de un ítem "en proceso" (bodega `20`) ya estaba incluida en su `onHand` (la suma de Kardex es por ítem en todas las bodegas) — no hacía falta una fuente adicional, así que el campo `scheduled` se eliminó de `BalanceNode` sin cambiar el resultado final (`onHand + scheduled` en el código viejo era matemáticamente equivalente a `onHand` ahora).
- **Stock de seguridad:** se deriva del promedio de demanda semanal por ítem — `total pedido por ítem / semanas cubiertas por el rango real de fechas en Pedidos` — multiplicado por unas "semanas de colchón" configurables en Administración (`configuracion.semanas_colchon_stock_seguridad`, default 2). El rango de semanas es global (no por ítem) para no inflar el promedio de ítems con pocos pedidos.
- Verificado contra datos reales tras el cambio: 401 nodos tocados, 24 insumos en déficit crítico (de 120 con necesidad), 50 piezas en déficit crítico (de 152) — cambia respecto a la cifra de 2026-09-10 porque además cambiaron los datos reales cargados (Productos/BOM/Kardex se resubieron el 2026-09-11/12).
- Limitación conocida y aceptada: el promedio semanal se calcula sobre TODO el rango histórico de `pedidos` (hoy hasta 2.5 años, con huecos grandes) — un ítem nuevo con pocos meses de historia puede quedar subestimado. No se afinó más porque el usuario pidió esta fórmula tal cual; se puede revisar si en la práctica resulta impreciso.

- **Necesidad de Compra (Insumos):** ítems "hoja" (sin receta propia) de categoría `materia_prima` o `empaque_complementario` con demanda > 0 (`lib/balance/queries.ts` → `getNecesidadCompra()`).
- **Necesidad de Inyección (Piezas):** ítems categoría `en_proceso` con demanda > 0, sin importar si son hoja o intermedios de un BOM multinivel (`getNecesidadInyeccion()`).
- Los ítems categoría `tiempo` se excluyen de ambas vistas — no son comprables ni inyectables, son minutos de mano de obra (Capacidad de Mano de Obra sigue fuera de alcance).
- **Probado contra datos reales:** 543 nodos tocados por la explosión (de 1,912 productos totales — solo se calcula lo que la demanda real alcanza), 162 insumos con necesidad calculada (18 en déficit crítico), 200 piezas con necesidad (26 en déficit crítico). Ejemplos de déficit real: esponjas, displays, tornillos (insumos); tapas, bases, recipientes inyectados (piezas) — cantidades y nombres consistentes con lo esperado de una planta de manufactura de plástico.
- Pantallas conectadas: `/purchasing` y `/injection` ya muestran datos reales (tabla con búsqueda + drawer de detalle, componente compartido `components/balance/necesidad-table.tsx`), y el Dashboard (`/dashboard`) muestra KPIs reales (insumos/piezas en déficit, pedidos pendientes) y una lista de alertas críticas.
- **Nota de arquitectura importante:** las páginas de `(dashboard)` necesitaron `export const dynamic = "force-dynamic"` — sin eso, `next build` intentaba pre-renderizarlas (a pesar de estar detrás de auth) y el build se colgaba >60s por cada página que hace consultas reales a Supabase, hasta fallar. También se cambió `lib/db/client.ts` para crear la conexión de forma perezosa (via `Proxy`, solo al primer uso real) en vez de al importar el módulo — antes, cualquier página que importara algo de `lib/balance/*` a nivel de archivo crasheaba en build/arranque si `DATABASE_URL` no estaba configurado, sin llegar siquiera a ejecutar el chequeo `isDatabaseConfigured()`.
- **Bug real encontrado probando el login de punta a punta (2026-09-10):** el Dashboard tardaba 10-20s en cargar (visto en producción: `POST /login` con la redirección tardó 19.6s). Causa: `getBalanceSummary()`, `getNecesidadCompra()` y `getNecesidadInyeccion()` llaman cada una a `computeBalance()` de forma independiente, y el Dashboard las invoca las tres en el mismo render (`Promise.all`) — eso eran 3 explosiones de BOM completas (18 consultas) en vez de 1 (6 consultas). Se arregló memoizando `computeBalance()` y `getUmbralAdvertenciaPct()` con `cache()` de React (memoización por request — no hay que gestionar invalidación a mano, cada request nueva recalcula fresco). De paso, `lib/db/client.ts` pasó a guardar el singleton de conexión en `globalThis` en vez de una variable de módulo, para que sobreviva los Fast Refresh de `next dev` sin abrir una conexión nueva contra el pooler de Supabase en cada recarga.

---

## 9. Riesgos y Supuestos Abiertos

| # | Ítem | Estado |
|---|---|---|
| 1 | Confirmación de TI sobre licenciamiento/estándar de BD (se decidió Supabase/Postgres, ya resuelto) | ✅ Resuelto |
| 2 | Fecha de integración directa API/BD Novasoft | ❓ Sin confirmar — se diseña para que no bloquee el MVP |
| 3 | Layout irregular de `Resumen general Tiempo` (capacidad M.O.) | 🟡 Bypass v1: disponibilidad se configura a mano (`/labor`), no se ingesta. La necesidad de minutos sí es real (sale del motor de balance). Sigue pendiente mapear la hoja si se quiere automatizar la disponibilidad también |
| 4 | Volumen de datos crece y excede límites de duración de función de Vercel | 🟡 Bajo riesgo hoy (volúmenes actuales: cientos a ~5,000 filas/hoja); monitorear si los archivos crecen |
| 5 | ~~Naming de `fichas.nombre`~~ | ✅ Ya no aplica — no existe tabla `fichas`, `productos.nombre` es la única fuente de verdad para el nombre |
| 7 | `npx drizzle-kit push` (v0.31.10) crashea contra Supabase (Postgres 17) — bug conocido de drizzle-kit al introspeccionar constraints `NOT NULL` (contype `n`, nuevo en PG17), aunque `schemaFilter: ["public"]` esté configurado en `drizzle.config.ts` | 🟡 **Workaround activo:** aplicar cambios de esquema con SQL directo (`ALTER TABLE ...`) contra `DATABASE_URL` en vez de `push`, hasta que se actualice drizzle-kit o se confirme un fix |
| 6 | ~~Códigos de bodega reales (`15`,`99`,`A0`,`B0`) distintos de los asumidos (`50`,`90`)~~ | ✅ Resuelto — confirmado con el usuario y corregido en `lib/ingestion/productos.ts` |

---

## 10. Roadmap Propuesto

1. ✅ **Setup del proyecto — completo:** Next.js 16 + Supabase (Auth/Storage/Postgres) + Drizzle, esquema completo de las 9 tablas, shell de la app (sidebar, header, navegación, login). Proyecto real de Supabase creado y conectado. El middleware de autenticación (`proxy.ts`) se probó y funciona: redirige a `/login` sin sesión, y el usuario confirmó login exitoso con un usuario real creado en Supabase.
2. ✅ **Carga de Datos v1 — completo:** las 7 fuentes crudas tienen parser (`lib/ingestion/`) y endpoint (`app/api/ingest`), probadas contra el Excel real y escritas en Supabase:
   - **Productos:** 1,912/1,913 filas (upsert por `item_code`, acumulativo).
   - **Kardex:** 1,189/1,190 filas (reemplazo completo).
   - **BOM:** 4,903/4,906 filas (reemplazo completo). Al construirlo se descubrió que no existe tabla `fichas` separada — ver §6.3 — y que el BOM es multinivel.
   - **Pedidos:** 766/766 filas. **Stock de Seguridad:** 127/127 filas. **Órdenes en Proceso:** 324/324 filas. **Mallas:** 514/514 filas.
   - Se detectó y corrigió un problema de rendimiento real en la ingesta por lotes: reintentar un lote fallido fila por fila era muy lento (41s para ~1,200 filas); se cambió a partir el lote a la mitad recursivamente para aislar solo las filas problemáticas (`lib/db/bulk-insert.ts`).
   - Nota operativa: `npx drizzle-kit push` no funciona contra este proyecto (bug de introspección con Postgres 17) — cambios de esquema se aplican con SQL directo por ahora (ver riesgo #7 arriba).
3. ✅ **Motor de Balance v1 — completo:** explosión de BOM multinivel con netting por nivel (ver §8), probado contra datos reales (162 insumos calculados / 18 en déficit, 200 piezas calculadas / 26 en déficit, ~1s de cómputo). Pantallas `/purchasing` e `/injection` ya muestran datos reales con búsqueda y drawer de detalle; Dashboard con KPIs y alertas críticas reales.
4. ✅ **Pedidos y Clientes — completo:** `/orders` muestra los 64 pedidos reales (agrupados por `numero_pedido`, cruzados con `mallas_clientes` por NIT) con estado derivado de la fecha de entrega (`estado_pedido` viene siempre vacío en el export real, así que se calcula: vencido → Crítico, ≤7 días → En Riesgo, si no → A Tiempo). Ver `lib/orders/queries.ts`.
5. ✅ **Umbral configurable — completo:** nueva tabla `configuracion` (clave/valor). Un balance negativo siempre es Crítico; un balance positivo con menos de `umbral_advertencia_pct`% de colchón sobre la necesidad se marca Advertencia en vez de Cubierto. Editable en `/admin`, aplica de inmediato a `/purchasing`, `/injection` y al Dashboard (`lib/config/`).
6. ✅ **Capacidad de Mano de Obra — v1 simplificado:** la hoja "Resumen general Tiempo" del Excel sigue sin poder mapearse automáticamente (layout irregular, ver riesgo #3 en la tabla de arriba), así que la **disponibilidad** se configura a mano por día (`/labor`, tabla `capacidad_mano_obra`, formularios simples). La **necesidad** sí es real: se suma directamente de los nodos categoría `tiempo` que el motor de balance ya calcula (55,210 minutos/semana contra los datos reales de hoy). No hay todavía distribución de la necesidad por día — eso requeriría programación hacia atrás desde `fecha_entrega`, no implementada aún.
7. **Roles con RLS:** decisión consciente del usuario (2026-09-10) — **fuera de alcance para la primera entrega**. Hoy cualquier usuario autenticado ve todo, sin distinción Planeación/Compras/Gerencia/Administrador; para lo que se necesita entregar ahora, eso es aceptable. Se retoma después de la primera entrega si hace falta.
8. ✅ **Predicción de Demanda y Análisis Dinámico BI — implementados (2026-09-12),** ver §12.
9. **Futuro (no confirmado):** integración directa Novasoft.

## 11. Estado para la Primera Entrega (2026-09-10)

Con la decisión de dejar roles/RLS fuera de esta entrega, los pasos 1-6 del roadmap cubren lo necesario: proyecto en producción (Supabase + Vercel-ready), ingesta de las 7 fuentes de datos probada con el Excel real, motor de balance con explosión de BOM multinivel probado contra datos reales, y las pantallas de Dashboard, Carga de Datos, Nec. Compra, Nec. Inyección, Pedidos, Capacidad de Mano de Obra (v1) y Administración conectadas a datos reales. Login verificado de punta a punta por el usuario.

## 12. Predicción de Demanda y Análisis Dinámico (BI) — implementados 2026-09-12

### 12.1 Predicción de Demanda
`pedidos` se reemplaza por completo en cada carga (es un snapshot, no un histórico), así que no hay una serie de tiempo real de ventas ya lista. Decisión con el usuario: en vez de esperar a tener un reporte histórico de Novasoft, **se empieza a acumular desde ahora** — cada carga de Pedidos recalcula el total real pedido por mes (según `pedidos.fecha`, agrupado `YYYY-MM`) y lo guarda/actualiza en la nueva tabla `demanda_historica_mensual` (`lib/demand/queries.ts` → `capturarSnapshotMensual()`, llamada desde `ingestPedidos` en `app/api/ingest/route.ts`). Así el histórico crece con el tiempo sin depender de que `pedidos` conserve datos viejos.

La pantalla `/prediction` muestra esos meses reales más una proyección de regresión lineal simple (mínimos cuadrados sobre meses calendario reales transcurridos — importante: los datos son ralos, con huecos de meses o años entre cargas, así que la regresión pondera el tiempo real entre puntos, no la posición en el arreglo). Con menos de 3 meses de histórico no se muestra proyección — se prefiere no proyectar a inventar una tendencia sin base. Backfill inicial: al implementar esto ya había 766 filas reales de `pedidos` cargadas en sesiones anteriores (fechas 2023-11 a 2026-07), así que el primer cálculo ya arrancó con 6 meses reales de histórico en vez de una pantalla vacía.

### 12.2 Análisis Dinámico (BI)
Constructor de reportes ad-hoc sobre datos reales (`lib/analytics/`): el usuario elige una fuente (Kardex de Inventario, BOM, Pedidos de Clientes), una o más dimensiones y una medida, de un **whitelist fijo por fuente** (`lib/analytics/sources.ts`) — nunca SQL ni columnas libres, así que es dinámico sin riesgo de inyección. `runReporte()` arma el `SELECT`/`GROUP BY` dinámicamente contra ese whitelist y devuelve filas agregadas reales; el resultado se grafica como barras o líneas (Recharts). Los reportes se pueden guardar (tabla `reportes_guardados`) y recargar desde la pestaña "Mis Reportes Guardados".

Simplificación consciente frente al mockup original: la selección de dimensiones es por botones tipo "chip" (clic para agregar/quitar), no arrastrar-y-soltar — `@dnd-kit` seguía instalado desde el scaffold inicial pero nunca se había usado; se prefirió una interacción más simple y robusta de construir para la v1. Se puede revisar drag-and-drop real más adelante si hace falta.

Probado contra datos reales: Kardex por categoría (existencia sumada), BOM por unidad de medida, Pedidos por mes y por zona — números consistentes con lo esperado.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
