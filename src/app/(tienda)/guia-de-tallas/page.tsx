import type { Metadata } from "next";

export const metadata: Metadata = { title: "Guía de tallas" };

// Equivalencias aproximadas por largo del pie (cm)
const rows = [
  [34, "22,0", "4", "35"],
  [35, "22,5", "5", "36"],
  [36, "23,5", "6", "37"],
  [37, "24,0", "6,5", "38"],
  [38, "25,0", "7,5", "39"],
  [39, "25,5", "8", "40"],
  [40, "26,5", "9", "41"],
  [41, "27,0", "10", "42"],
];

export default function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow text-gold">Ayuda</p>
      <h1 className="mt-2 text-4xl">Guía de tallas</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Mide tu pie al final del día: apóyalo sobre una hoja, marca el talón y la punta del dedo más largo y mide la
        distancia en centímetros. Si estás entre dos tallas, elige la mayor.
      </p>
      <div className="mt-8 overflow-hidden border border-line">
        <table className="w-full text-center text-sm">
          <thead className="eyebrow bg-sand text-[0.62rem]">
            <tr>
              <th className="py-3">Colombia</th>
              <th>Largo del pie</th>
              <th>EE. UU.</th>
              <th>Europa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {rows.map(([co, cm, us, eu]) => (
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
