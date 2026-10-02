import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pedidos, mallasClientes } from "@/lib/db/schema";

export type EstadoPedido = "Crítico" | "En Riesgo" | "A Tiempo";

export type PedidoResumen = {
  numeroPedido: string;
  clienteNombre: string;
  fechaEntrega: string | null;
  cantidadTotal: number;
  zona: string | null;
  diaMalla: string | null;
  estado: EstadoPedido;
};

const DIAS_RIESGO = 7;

/**
 * `estado_pedido` viene siempre vacío en el export de Novasoft (confirmado
 * contra el archivo real) — se deriva un estado a partir de la fecha de
 * entrega comprometida en vez de mostrar un campo vacío.
 */
function estadoPorFecha(fechaEntrega: string | null): EstadoPedido {
  if (!fechaEntrega) return "A Tiempo";
  const dias = (new Date(fechaEntrega).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (dias < 0) return "Crítico";
  if (dias <= DIAS_RIESGO) return "En Riesgo";
  return "A Tiempo";
}

export async function getPedidosPendientes(): Promise<PedidoResumen[]> {
  const [rows, mallas] = await Promise.all([
    db
      .select({
        numeroPedido: pedidos.numeroPedido,
        clienteNit: pedidos.clienteNit,
        clienteNombre: pedidos.clienteNombre,
        fechaEntrega: sql<string | null>`max(${pedidos.fechaEntrega})`,
        cantidadTotal: sql<string>`sum(${pedidos.cantidad})`,
      })
      .from(pedidos)
      .groupBy(pedidos.numeroPedido, pedidos.clienteNit, pedidos.clienteNombre),
    db
      .select({
        nitCliente: mallasClientes.nitCliente,
        zona: mallasClientes.nombreZona,
        diaMalla: mallasClientes.diaMalla,
      })
      .from(mallasClientes),
  ]);

  const mallaPorNit = new Map(mallas.map((m) => [m.nitCliente, m]));

  return rows
    .map((r) => {
      const malla = r.clienteNit ? mallaPorNit.get(r.clienteNit) : undefined;
      return {
        numeroPedido: r.numeroPedido,
        clienteNombre: r.clienteNombre ?? "—",
        fechaEntrega: r.fechaEntrega,
        cantidadTotal: Number(r.cantidadTotal ?? 0),
        zona: malla?.zona ?? null,
        diaMalla: malla?.diaMalla ?? null,
        estado: estadoPorFecha(r.fechaEntrega),
      };
    })
    .sort((a, b) => {
      const order = { Crítico: 0, "En Riesgo": 1, "A Tiempo": 2 } as const;
      return order[a.estado] - order[b.estado];
    });
}
