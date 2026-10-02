"use server";

import { revalidatePath } from "next/cache";
import { setUmbralAdvertenciaPct, setSemanasColchonStockSeguridad } from "./queries";
import { setCapacidadDia, type DiaSemana } from "@/lib/labor/queries";

export async function updateUmbralAction(formData: FormData): Promise<void> {
  const pct = Number(formData.get("umbralAdvertenciaPct"));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return;

  await setUmbralAdvertenciaPct(pct);
  revalidatePath("/admin");
  revalidatePath("/purchasing");
  revalidatePath("/injection");
  revalidatePath("/dashboard");
}

export async function updateSemanasColchonAction(formData: FormData): Promise<void> {
  const semanas = Number(formData.get("semanasColchon"));
  if (!Number.isFinite(semanas) || semanas < 0) return;

  await setSemanasColchonStockSeguridad(semanas);
  revalidatePath("/admin");
  revalidatePath("/purchasing");
  revalidatePath("/injection");
  revalidatePath("/dashboard");
  revalidatePath("/labor");
}

export async function updateCapacidadDiaAction(formData: FormData): Promise<void> {
  const dia = String(formData.get("dia")) as DiaSemana;
  const minutosDisponibles = Number(formData.get("minutosDisponibles") ?? 0);
  const headcount = formData.get("headcount") ? Number(formData.get("headcount")) : null;
  const horasExtra = formData.get("horasExtra") ? Number(formData.get("horasExtra")) : null;
  const temporales = formData.get("temporales") ? Number(formData.get("temporales")) : null;

  if (!Number.isFinite(minutosDisponibles) || minutosDisponibles < 0) return;

  await setCapacidadDia(dia, { minutosDisponibles, headcount, horasExtra, temporales });
  revalidatePath("/admin");
  revalidatePath("/labor");
}
