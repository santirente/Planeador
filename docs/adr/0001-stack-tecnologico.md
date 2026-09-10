# ADR-0001: Stack Tecnológico para ProPlan (Planeación de Producción)

**Status:** Superseded por [ADR-0002](0002-confirmacion-stack-vercel-supabase.md)
**Date:** 2026-09-09
**Deciders:** Planeación, Compras, Gerencia, TI (a confirmar quién firma por TI/Infraestructura)

> **Nota:** las respuestas a los Action Items de este ADR (entorno, motor de BD, lenguaje de backend, alcance de ingesta) llegaron con Vercel + Supabase + monolito como restricciones fijas. Eso cambia la elección de backend (Python → Node.js) y de frontend (SPA separado → monolito Next.js). Ver [ADR-0002](0002-confirmacion-stack-vercel-supabase.md) para la decisión vigente.

## Contexto

ProPlan reemplaza un proceso manual basado en Excel para planear producción en una planta de manufactura de plástico (inyección y soplado). El contexto viene de tres fuentes que ya existen en este repo:

- [archivo-inicial.md](../reference/archivo-inicial.md) — visión de negocio, módulos core y una propuesta inicial de stack.
- [proplan_manufactura.tsx](../reference/proplan_manufactura.tsx) — mockup funcional del dashboard (React + Recharts + lucide-react + Tailwind), con 9 pantallas: Dashboard, Carga de Datos, Nec. Compra, Nec. Inyección, Capacidad M.O., Pedidos, Predicción Demanda, Análisis Dinámico (BI) y Administración.
- [Maestro_Planeacion Julio.xlsx](../reference/Maestro_Planeacion%20Julio.xlsx) — el archivo real que hoy usa el equipo, descargado/consolidado desde el ERP Novasoft.

Inspeccioné la estructura interna del Excel (no solo los datos, el XML/OOXML) y esto cambia varias decisiones de stack:

1. **No es un Excel simple.** Tiene 14 hojas, 6 pivot caches, un Data Model de Power Pivot (`model/item.data`) y conexiones de Power Query (`Consulta - Boom_Mat_Original`). El equipo de Planeación ya construyó, a mano, una mini bodega de datos dentro de Excel. Eso confirma que el dolor es real y que ya existe lógica de negocio (joins, agregaciones) que hay que migrar, no inventar desde cero.
2. **Los datos del ERP vienen con nomenclatura críptica y no normalizada**, típica de Novasoft: `item` (ej. `1001-000002`), `bod`/`cod_bod` (bodega), `matpri` (materia prima), `fichas` (código de BOM), `etapa` (`INY`), `t_exis` (existencia/stock), `ano_acu` (año), etc. Las hojas `Materiales` e `Inyeccion` ya calculan manualmente con fórmulas cruces tipo `Kardex + BOM + Pedidos → Necesidad Compra`, que es exactamente el "Motor de Balance" descrito en la sección 4.2 del `.md`.
3. **Volumen moderado, no "big data"**: hojas de cientos a ~4-5 mil filas (`Boom_Materiales`, `Listado de productos`). Esto descarta necesidad de infraestructura de big data (Spark, warehouses columnares) — un RDBMS bien indexado alcanza sobrado.
4. **Pista de entorno on-premise**: la ruta interna guardada en el archivo (`\\192.168.96.5\Planeacion\...`) indica que hoy los archivos viven en un servidor de archivos interno de la empresa, no en la nube. Esto es una señal, no una confirmación — hay que validarlo con TI antes de decidir hosting (ver Action Items).
5. El `.md` (sección 4.5) ya incluye **predicción de demanda** como módulo core, no como "nice to have" futuro — eso pesa en la elección de lenguaje de backend.

## Decisión

Se recomienda:

- **Frontend:** Vite + React 18 + TypeScript, Tailwind CSS, shadcn/ui (Radix), Recharts, TanStack Query, Zustand, dnd-kit.
- **Backend:** Python + FastAPI, Pydantic v2, SQLAlchemy 2.0 + Alembic, pandas + openpyxl para el ETL de Excel.
- **Base de datos:** PostgreSQL.
- **Cola/caché:** Redis + worker en background (RQ o Celery) para procesar cargas de Excel de forma asíncrona y cachear el módulo BI.
- **Auth:** JWT con roles (Planeación, Compras, Gerencia, Administrador), tal como ya lo modela el selector de rol del mockup.

Este stack es una **variación afinada** de la propuesta en `archivo-inicial.md` (que dejaba Node vs Python y Next.js vs SPA como abiertos): mismo espíritu, decisiones cerradas con justificación basada en el Excel real y en el mockup.

## Options Considered

### Backend: Python/FastAPI vs Node/NestJS

| Dimensión | Python + FastAPI | Node.js + NestJS |
|---|---|---|
| Complejidad | Media | Media |
| Ajuste a ETL de Excel real | Alto — `pandas`/`openpyxl` manejan bien múltiples hojas, filas con celdas vacías, "cargas parciales" fila por fila (requisito 4.1) | Medio — `xlsx`/`exceljs` funcionan pero los cruces tipo `merge`/`groupby` de pandas no tienen equivalente tan maduro en el ecosistema JS |
| Roadmap de Predicción de Demanda (ítem 4.5) | Alto — `statsmodels`, `prophet`, `scikit-learn` nativos, sin salir del lenguaje | Bajo — requeriría llamar a un microservicio Python de todos modos, terminando en un stack híbrido igual |
| Unificación de lenguaje con frontend (TS) | No (dos lenguajes) | Sí (un solo lenguaje) |
| Curva de equipo | Depende del equipo actual (ver Action Items) | Depende del equipo actual |

**Elección:** Python/FastAPI. El valor central de ProPlan es procesamiento de datos + forecasting, no solo CRUD; optimizar el backend para eso evita terminar con un microservicio Python "pegado" más adelante para la predicción de demanda.

### Frontend: Next.js vs Vite + React SPA

| Dimensión | Next.js | Vite + React SPA |
|---|---|---|
| Complejidad | Media-alta (SSR, routing por archivos, RSC) | Baja |
| Necesidad real | Bajo — es una herramienta interna detrás de login, sin SEO ni contenido público | — |
| Velocidad de desarrollo/HMR | Buena | Muy buena, menos overhead |
| Migración desde el mockup actual | El mockup ya es un SPA con `useState` para tabs/drawers — encaja 1:1 | Encaja 1:1 |

**Elección:** Vite + React + TypeScript. Next.js seguiría siendo válido si a futuro se quiere SSR o exponer algo público, pero para un dashboard interno agrega complejidad sin beneficio claro.

### Base de datos: PostgreSQL vs SQL Server

| Dimensión | PostgreSQL | SQL Server |
|---|---|---|
| Costo de licencia | Ninguno | Depende de licenciamiento existente |
| Encaje si TI ya opera Windows/SQL Server | Neutral | Alto, si ya hay expertise/infra interna |
| JSONB / flexibilidad para campos ERP cambiantes | Alto | Medio (JSON soportado pero menos idiomático) |
| Ecosistema open-source / Docker | Alto | Medio |

**Elección por defecto:** PostgreSQL, salvo que TI confirme que ya administran SQL Server on-prem y prefieran no sumar un motor nuevo — ver Action Items.

## Trade-off Analysis

La decisión más importante es el backend en Python en vez de Node, aun perdiendo la "unificación de lenguaje" con el frontend TypeScript. La razón: los datos de Novasoft no llegan limpios (nombres crípticos, celdas vacías, hojas con fórmulas cruzadas manualmente), y el roadmap del producto explícitamente pide forecasting estadístico. Pagar el costo de dos lenguajes ahora es más barato que terminar, en 6 meses, con Node para la API y un microservicio Python aparte solo para la predicción de demanda — eso sería más complejidad neta, no menos.

Un punto a favor adicional: el mockup (`proplan_manufactura.tsx`) ya importa `recharts` y `lucide-react` y usa clases Tailwind con un lenguaje visual "industrial" (Slate + Indigo + semáforo rojo/ámbar/verde). El stack de frontend recomendado no traduce el mockup a otra tecnología — lo lleva a producción casi tal cual, incluyendo el patrón de Drawer (mapea directo a `Sheet` de shadcn/ui) y el constructor drag & drop del módulo BI (mapea a `dnd-kit`).

## Consequences

- **Se vuelve más fácil:** cruces Kardex/BOM/Pedidos con manejo de errores fila por fila, ingestas parciales, y evolucionar el módulo de Predicción de Demanda sin migrar de lenguaje.
- **Se vuelve más difícil:** operar dos runtimes (Node para el build/dev del frontend, Python para el backend) en CI/CD y en el entorno de despliegue on-premise.
- **Habrá que revisitar:** el mecanismo de ingesta (hoy: parseo de Excel) el día que Novasoft exponga una API REST directa (mencionado como paso futuro en el `.md`, sección 2.2) — por eso conviene aislar la lógica de ingesta detrás de una capa de repositorio/servicio desde el inicio, para que ese cambio no toque el resto de la app.

## Action Items

1. [ ] Confirmar entorno de despliegue: ¿on-premise (la ruta `\\192.168.96.5\...` embebida en el Excel sugiere que sí) o nube? Define si Postgres es self-hosted o administrado, y si se necesita VPN para que Compras/Gerencia accedan.
2. [ ] Confirmar con TI si ya administran SQL Server u otro motor estándar, para decidir entre PostgreSQL y SQL Server con criterio de la organización, no solo técnico.
3. [ ] Confirmar el skillset real del equipo que va a construir/mantener esto (Python vs Node), para no imponer una curva de aprendizaje evitable.
4. [ ] Preguntar si hay fecha estimada para una API REST de Novasoft, para dimensionar cuánto invertir en la capa de parseo de Excel vs. dejarla deliberadamente simple/desechable.
5. [ ] Con el stack aprobado, siguiente paso natural: diseñar el modelo de datos en Postgres mapeando los campos crípticos de Novasoft (`item`, `bod`, `matpri`, `fichas`, `t_exis`, etc.) a entidades de dominio (Producto, Bodega, Insumo, BOM, Pedido, Kardex, Capacidad de Mano de Obra).

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
