import { Clock } from "lucide-react";

export function ComingSoon({ modulo }: { modulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-16 text-center">
      <Clock className="mb-4 h-12 w-12 text-slate-300" />
      <h2 className="text-lg font-semibold text-slate-800">{modulo}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Este módulo está planeado para una fase posterior del proyecto. Ver{" "}
        <code className="rounded bg-slate-100 px-1">docs/BLUEPRINT.md</code> para el roadmap.
      </p>
    </div>
  );
}
