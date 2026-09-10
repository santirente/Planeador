# ADR-0002: Confirmación de Stack — Monolito Next.js en Vercel + Supabase

**Status:** Accepted
**Date:** 2026-09-09
**Deciders:** Usuario (Planeación), Claude (asistencia de construcción)
**Supersedes:** Sección de Backend y Frontend de [ADR-0001](0001-stack-tecnologico.md)

## Contexto

Respuestas a los Action Items de ADR-0001:

1. **Entorno de despliegue:** Supabase (Postgres) + Vercel. Ya no es on-premise — descarta la duda sobre la ruta de red `\\192.168.96.5\...`.
2. **Motor de base de datos:** PostgreSQL, confirmado (vía Supabase).
3. **Lenguaje de backend:** el usuario deja la decisión final a mi criterio, con preferencia declarada por Node.js.
4. **API/BD directa de Novasoft:** no confirmada todavía. Sin fecha.
5. **Modelo de datos:** se abordará de forma incremental, analizando hoja por hoja junto con el usuario (no en un solo diseño cerrado).
6. **Arquitectura de la app:** el usuario pide explícitamente un **monolito bien estructurado**, no microservicios.
7. **Alcance inmediato:** por ahora la única fuente de datos es la **carga manual de los archivos Excel** que hoy exporta el equipo desde Novasoft. No hay integración directa a la base de datos/API de Novasoft — eso queda fuera de alcance hasta que se confirme.

Estas restricciones (Vercel + monolito) hacen irrelevante el argumento original a favor de Python/FastAPI (ADR-0001): Vercel es una plataforma nativa de Node.js/Next.js — Python ahí es ciudadano de segundo orden (cold starts más lentos, límites de duración de función más estrictos, sin soporte oficial de frameworks como FastAPI de forma nativa). Meter Python habría significado, en la práctica, dos runtimes desplegados por separado — justo lo contrario de "monolito bien estructurado".

## Decisión

**Next.js (App Router) en TypeScript como monolito único**, desplegado en Vercel:

- **Frontend + Backend unificados:** Next.js. Las pantallas del mockup ([proplan_manufactura.tsx](../reference/proplan_manufactura.tsx)) se implementan como rutas/páginas; la lógica de servidor (ingesta de Excel, motor de balance, consultas BI) vive en **Route Handlers** (`app/api/*`) y/o **Server Actions**, no en un servicio aparte.
- **Base de datos:** Supabase Postgres.
- **ORM:** Drizzle ORM + `drizzle-kit` para migraciones. (Alternativa válida: Prisma; se prefiere Drizzle por menor fricción histórica con el runtime serverless/edge de Vercel y por generar SQL más predecible para el motor de balance, que va a tener queries con varios `JOIN`/`GROUP BY`.)
- **Auth y roles:** Supabase Auth, con Row Level Security (RLS) en Postgres para los 4 roles del mockup (Planeación, Compras, Gerencia, Administrador) — en vez de rearmar JWT y control de acceso a mano.
- **Almacenamiento de archivos:** Supabase Storage para guardar el Excel original de cada carga (trazabilidad: "qué archivo generó qué datos").
- **Parseo de Excel:** `exceljs` en el servidor (Route Handler), leyendo únicamente las hojas fuente identificadas como datos crudos (ver más abajo) — no las hojas que ya son tablas dinámicas/calculadas.
- **UI:** se mantiene lo ya validado — Tailwind CSS, shadcn/ui, Recharts, TanStack Query, Zustand (estado del constructor BI), dnd-kit (drag & drop del módulo de Análisis Dinámico).

## Alcance confirmado para esta fase

- ✅ Ingesta **solo** por carga manual de archivos Excel (equivalente a lo que hoy hace el equipo, pero automatizado y validado).
- ❌ Sin conexión directa a la base de datos o API de Novasoft — se deja el punto de ingesta aislado detrás de una capa propia (`lib/ingestion/*`) para que, cuando haya API, sólo cambie *cómo entran los datos*, no el resto del sistema.
- El motor de balance, BI y predicción de demanda operan sobre lo que ya esté en Supabase, sin importar si llegó por Excel o (a futuro) por API.

## Opciones descartadas (y por qué, dado el nuevo contexto)

| Opción | Por qué no |
|---|---|
| Python/FastAPI + frontend separado (ADR-0001 original) | Vercel no es su hábitat natural; obligaría a un segundo servicio/hosting, rompiendo el requisito de monolito |
| Node/NestJS + Vite SPA separados | Funcionaría, pero en Vercel es más simple y más idiomático tener un solo proyecto Next.js que backend y frontend por separado — menos piezas que desplegar/mantener |
| Prisma como ORM | Válido, pero se prefiere Drizzle por queries más explícitas para el motor de balance y mejor comportamiento en entornos serverless/edge |

## Consecuencias

- **Más fácil:** un solo repo, un solo deploy (`git push` → Vercel), un solo lenguaje (TypeScript) de UI a base de datos, RLS de Supabase resolviendo permisos por rol sin reinventar auth.
- **Más difícil / a vigilar:** los **límites de duración de función serverless de Vercel** (10s en plan Hobby; configurable con `maxDuration` en Pro). Los volúmenes reales que revisamos en el Excel (cientos a ~5,000 filas por hoja) deberían procesarse en segundos con `exceljs`, así que no se anticipa problema — pero si a futuro los archivos crecen mucho, la salida es mover el parseo pesado a una Vercel Function con `maxDuration` alto o a un job en background, no cambiar de lenguaje.
- **A revisitar más adelante:**
  - *Predicción de demanda* (ítem 4.5 del `.md`): con este stack se hace en TypeScript con métodos estadísticos simples (medias móviles, regresión lineal, suavizado exponencial) para la primera versión. Si más adelante se necesita algo más sofisticado (Prophet, modelos ARIMA), se puede aislar como una función serverless de Python separada *solo para ese endpoint*, sin tocar el resto del monolito — pero no se construye eso ahora (no hay ese requisito todavía).
  - *Integración directa con Novasoft*: cuando se confirme, se implementa dentro de `lib/ingestion/*` como una fuente adicional junto a la de "Excel manual", sin rediseñar el resto de la app.

## Siguiente paso

Diseño incremental del modelo de datos en Supabase, hoja por hoja, distinguiendo **fuentes crudas a ingestar** de **vistas ya calculadas en Excel que el motor de balance debe reproducir en la app** (no volver a importar los números ya calculados). Ver la propuesta inicial de mapeo compartida en la conversación — pendiente de confirmar antes de escribir el esquema SQL definitivo.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
