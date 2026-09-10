# Documento de Visión y Arquitectura: ProPlan - Manufactura

## 1. Visión del Negocio (Business Concept)
**ProPlan** es una aplicación de planeación de producción diseñada específicamente para plantas de manufactura de plástico (procesos de inyección y soplado). 

### 1.1. Problema a resolver
Actualmente, el proceso de planeación se realiza mediante hojas de cálculo de Excel extremadamente densas y pesadas. Esto genera:
*   Riesgos de errores humanos en el cruce de datos.
*   Retrasos en la toma de decisiones por el tiempo que toma procesar la información.
*   Falta de visibilidad en tiempo real para gerencia y compras.

### 1.2. Solución y Valor Agregado
La aplicación automatiza la ingesta de datos provenientes del ERP actual (Novasoft) y realiza cruces algorítmicos instantáneos entre el Catálogo, el Kardex (Inventario), la Lista de Materiales (BOM) y los Pedidos. El sistema determina con precisión:
1.  Qué insumos de empaque faltan por comprar (y cuándo).
2.  Qué piezas plásticas se necesitan inyectar para cumplir la demanda.
3.  Si la capacidad de mano de obra es suficiente para la semana.

### 1.3. Usuarios Objetivo
*   **Planeación de Producción:** Uso intensivo operativo, revisión de balances y programación.
*   **Compras:** Visualización de alertas de déficit de insumos para emitir órdenes de compra.
*   **Gerencia:** Visualización de KPIs de cumplimiento, capacidad y predicción de demanda.

---

## 2. Aspectos Técnicos (Arquitectura Sugerida)

Para llevar los mockups a un entorno productivo real, se sugiere el siguiente stack tecnológico moderno:

### 2.1. Frontend (Capa de Presentación)
*   **Framework:** React.js (o Next.js para un mejor enrutamiento y rendimiento).
*   **Estilos:** Tailwind CSS. Permite construir una interfaz densa y "estilo industrial" rápidamente manteniendo consistencia.
*   **Gráficos:** Recharts o Chart.js para el renderizado del Análisis Dinámico (BI) y predicciones.
*   **Gestión de Estado:** Zustand o Redux Toolkit (esencial para manejar los cruces de datos grandes entre módulos sin recargar la página).

### 2.2. Backend (Capa Lógica)
*   **Entorno:** Node.js con Express, o Python (FastAPI/Django) si se planea desarrollar algoritmos de Machine Learning robustos para la predicción de demanda.
*   **Integración ERP:** Módulo de procesamiento de archivos (ETL) para leer los Excel exportados de Novasoft (usando librerías como `xlsx` en Node o `pandas` en Python). A futuro, desarrollar una API REST para conexión directa al ERP.

### 2.3. Base de Datos
*   **Principal:** PostgreSQL (Relacional, ideal para mantener la integridad de los datos entre Kardex, Pedidos y BOM).
*   **Caché:** Redis (Opcional, pero recomendado para acelerar las consultas del módulo de "Análisis Dinámico BI" donde los usuarios arrastran campos en tiempo real).

---

## 3. UI/UX y Sistema de Diseño (Design System)

### 3.1. Filosofía Visual
*   **Estilo Industrial/Dashboard:** La herramienta no es "divertida" ni lúdica; es una herramienta de trabajo crítico. Diseño limpio, denso en datos (alta cantidad de información por pantalla sin abrumar), inspirado en Power BI, Tableau o sistemas MES modernos.
*   **Layout:** Navegación lateral fija izquierda (Sidebar) y un lienzo principal scrolleable con contenedores tipo "Card".

### 3.2. Código de Colores Semántico
El sistema de alertas visuales debe ser inequívoco y consistente en toda la plataforma:
*   🔴 **Rojo (Crítico / Déficit):** Faltante inminente que detiene la producción o pedido en riesgo.
*   🟡 **Ámbar (Advertencia):** Niveles cercanos al límite, alertas de validación (ej. Excel con filas defectuosas).
*   🟢 **Verde (Ok / Cubierto):** Inventario sano, capacidad suficiente, carga exitosa.
*   🔵 **Azules/Grises (Corporativo):** Base de la interfaz para fondos, bordes, tablas y tipografías (ej. Slate-800, Slate-50, Indigo-600).

### 3.3. Interacciones Clave
*   **Drawers (Paneles Laterales):** Al hacer clic en un producto o insumo en una tabla, no se cambia de página. Se abre un panel lateral superpuesto para ver detalles, historial y BOM. Esto mantiene el contexto del usuario.
*   **Drag & Drop (Arrastrar y soltar):** Esencial en el módulo de Carga de Datos y crucial en el módulo de Análisis Dinámico BI.

---

## 4. Elementos Principales (Módulos Core)

1.  **Ingesta de Datos:** Debe tolerar errores humanos. Si el Excel del ERP viene con celdas vacías, el sistema debe indicar qué fila falló sin cancelar toda la carga de los datos correctos (Cargas parciales).
2.  **Motor de Balance (Core):**
    *   *Fórmula base:* `(Stock en Kardex + Programado/En Tránsito) - (Necesidad por Pedidos) = Balance`
    *   Si Balance < 0 = Déficit (Alerta roja).
3.  **Capacidad de Mano de Obra:** Cruce de requerimientos en minutos estándar por producto vs. disponibilidad del personal del turno (considerando horas extra y temporales).
4.  **Análisis Dinámico (Módulo BI):** Permite a los usuarios cruzar dimensiones (Bodega, Producto, Cliente) contra medidas (Cantidad, Minutos, Costo) de forma autónoma sin pedir reportes al área de TI.
5.  **Predicción de Demanda:** Gráfico que compara el histórico real de ventas vs. la proyección estadística (estacionalidad y tendencias) para prever requerimientos de inyección a mediano plazo.