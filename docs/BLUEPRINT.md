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
Balance = (Kardex + Programado/En Tránsito) − (Necesidad por Pedidos + Stock de Seguridad)
```

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

### 6.3 Dos espacios de códigos distintos (confirmado)
- `productos.item_code` — formato `NNNN-NNNNNN` (ej. `1001-000002`): catálogo de insumos/inventario físico.
- `fichas.ficha_code` — formato `NNNN-NNN-NN` (ej. `2001-001-01`, `3003-007-01`): recetas/piezas producidas, **espacio de numeración propio**, no vive en `Listado de productos`.

### 6.4 Tablas (fuentes crudas a ingestar)

| Tabla | Hoja Excel origen | Contenido |
|---|---|---|
| `productos` | `1. Listado de productos` | Catálogo maestro de ítems |
| `fichas` | (derivado de `Boom_Materiales`, `Materiales`, `Inyeccion`, `En proceso Inyeccion`) | Maestro de recetas/piezas producidas |
| `bom_items` | `3.Boom_Materiales` (solo cols A:L) | Receta: `ficha_code` → `matpri_code` × `cantidad`; `es_tiempo=true` si `matpri_code` es bodega `90` |
| `kardex_existencias` | `4. Kardex NS diario` | Snapshot de existencias (solo el más reciente, sin histórico diario) |
| `pedidos` | `5. Pedidos_Novasoft` | Pedidos reales de clientes |
| `demanda_stock_seguridad` | `6. Stock Semanal` | Objetivo de ~2 semanas de stock; se suma a `pedidos` como demanda adicional (no es inventario) |
| `ordenes_produccion_inyeccion` | `En proceso Inyeccion` | Órdenes de inyección en curso (`ficha_code`, cantidad programada/entregada, máquina) |
| `mallas_clientes` | `2. Listado de mallas` | Referencia de rutas/zonas de despacho por cliente |
| `cargas` | — | Log de cada ingesta: archivo, usuario, filas OK/error, detalle de errores (`jsonb`) |

### 6.5 No son tablas — se calculan en la app
`Materiales`, `Inyeccion`, `7. Pedidos`, `8. Resumen general Tiempo`, `td. kardex` → reemplazadas por queries del motor de balance sobre las tablas de arriba.

### 6.6 Hojas descartadas
`Hoja1`, `Hc cumpleaños` — no relevantes para el sistema.

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
| **Predicción Demanda** | Gráfico venta real vs proyección | Fase posterior |
| **Análisis Dinámico (BI)** | Constructor drag & drop de dimensiones/medidas, reportes guardados | Fase posterior |
| **Administración** | Umbrales de déficit crítico, estado de integración ERP, roles | MVP (básico) |

Patrón transversal: clic en cualquier fila abre un **Drawer** con detalle, histórico y acción sugerida (ej. "Generar Solicitud" de compra) — no navega a otra página.

---

## 8. Motor de Balance (lógica core)

```
Balance = (Stock en Kardex + Programado/En Tránsito) − (Necesidad por Pedidos + Stock de Seguridad)

Si Balance < 0 → Déficit (alerta roja)
```

- **Insumos (Compras):** `kardex_existencias` (bodega 10/50) + nada en tránsito por ahora vs. `bom_items` explotado desde la demanda de piezas/producto terminado.
- **Piezas (Inyección):** `kardex_existencias` (bodega 20) + `ordenes_produccion_inyeccion` (programado) vs. necesidad derivada de `pedidos` + `demanda_stock_seguridad`, explotada a través de `bom_items`.
- **Demanda total** = `pedidos` (reales) + `demanda_stock_seguridad` (objetivo ~2 semanas) — ambas se sacan de tablas separadas pero se combinan para el cálculo, replicando lo que hoy el Excel hace con la columna "Stock Sem + Pedido".

---

## 9. Riesgos y Supuestos Abiertos

| # | Ítem | Estado |
|---|---|---|
| 1 | Confirmación de TI sobre licenciamiento/estándar de BD (se decidió Supabase/Postgres, ya resuelto) | ✅ Resuelto |
| 2 | Fecha de integración directa API/BD Novasoft | ❓ Sin confirmar — se diseña para que no bloquee el MVP |
| 3 | Layout irregular de `Resumen general Tiempo` (capacidad M.O.) | ⏸️ Diferido — se modela en fase posterior con el usuario |
| 4 | Volumen de datos crece y excede límites de duración de función de Vercel | 🟡 Bajo riesgo hoy (volúmenes actuales: cientos a ~5,000 filas/hoja); monitorear si los archivos crecen |
| 5 | Naming de `fichas.nombre` cuando difiere entre `nombre`/`Nombre2`/`Alterno` según la hoja de origen | 🟡 Definir regla de precedencia al construir el parser |
| 6 | ~~Códigos de bodega reales (`15`,`99`,`A0`,`B0`) distintos de los asumidos (`50`,`90`)~~ | ✅ Resuelto — confirmado con el usuario y corregido en `lib/ingestion/productos.ts` |

---

## 10. Roadmap Propuesto

1. ✅ **Setup del proyecto:** Next.js 16 + Supabase (Auth/Storage/Postgres) + Drizzle, esquema completo de las 9 tablas, shell de la app (sidebar, header, navegación, login) — implementado y verificado (`npm run build` y navegación en browser OK). Pendiente: crear el proyecto real en Supabase y completar `.env.local` (ver `.env.example`).
2. **Carga de Datos v1:** subir y validar Productos, BOM, Kardex (mínimo para que el motor de balance de insumos/piezas funcione con datos reales).
   - Parser de **Productos** (`lib/ingestion/productos.ts`) y endpoint (`app/api/ingest`) implementados y probados contra el Excel real (1,382/1,925 filas cargables hoy; el resto son filas legítimamente excluidas o pendientes de revisión menor, ver riesgo #6, ya resuelto). Falta probar la escritura real en Supabase una vez exista el proyecto.
   - Parsers de BOM y Kardex: pendientes.
3. **Motor de Balance v1:** Necesidad de Compra + Necesidad de Inyección, sin pedidos reales todavía (usando solo `demanda_stock_seguridad` como demanda).
4. **Pedidos:** ingestar `pedidos` y `mallas_clientes`, sumar a la demanda real, pantalla Pedidos y Clientes.
5. **Órdenes en proceso:** ingestar `ordenes_produccion_inyeccion`, afinar el balance de piezas con "programado".
6. **Dashboard + Administración:** KPIs, alertas, umbrales configurables, roles con RLS.
7. **Fase posterior:** Capacidad de Mano de Obra, Predicción de Demanda, Análisis Dinámico BI.
8. **Futuro (no confirmado):** integración directa Novasoft.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
