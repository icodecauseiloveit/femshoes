import type { Metadata } from "next";
import { measureTip, sizeGuide } from "@/lib/size-guide";

export const metadata: Metadata = { title: "Guía de tallas" };

export default function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow text-gold">Ayuda</p>
      <h1 className="mt-2 text-4xl">Guía de tallas</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {measureTip}
      </p>
      <div className="mt-8 overflow-hidden border border-line">
        <table className="w-full text-center text-sm">
          <thead className="eyebrow bg-mist text-[0.62rem]">
            <tr>
              <th className="py-3">Colombia</th>
              <th>Largo del pie</th>
              <th>EE. UU.</th>
              <th>Europa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {sizeGuide.map(({ co, cm, us, eu }) => (
              <tr key={co}>
                <td className="py-3 font-medium">{co}</td>
                <td>{cm} cm</td>
                <td>{us}</td>
                <td>{eu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">
        Las medidas son aproximadas y pueden variar según la horma de cada modelo. Escríbenos por WhatsApp y te
        asesoramos.
      </p>
    </div>
  );
}
