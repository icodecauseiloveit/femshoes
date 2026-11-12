import type { Metadata } from "next";
import { store } from "@/lib/config";

export const metadata: Metadata = { title: "Tratamiento de datos personales" };

export default function DataPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="eyebrow text-gold">Ayuda</p>
      <h1 className="mt-2 text-4xl">Tratamiento de datos personales</h1>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="mb-2 text-2xl text-ink">Quién trata tus datos</h2>
          <p>
            {store.name} es responsable del tratamiento de los datos personales que nos entregas al hacer un pedido, en
            cumplimiento de la Ley 1581 de 2012 y sus normas reglamentarias. Puedes contactarnos por WhatsApp al{" "}
            {store.whatsappDisplay}.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-2xl text-ink">Qué datos recogemos</h2>
          <p>Nombre, celular, ciudad, dirección y barrio de entrega, forma de pago preferida y el detalle de tus pedidos.</p>
        </section>
        <section>
          <h2 className="mb-2 text-2xl text-ink">Para qué los usamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Gestionar tus pedidos: confirmar disponibilidad, coordinar el envío, el pago, cambios y garantías.</li>
            <li>Atender tus solicitudes y mantener el historial de tus compras.</li>
            <li>
              Solo si lo autorizas al hacer tu pedido: enviarte por WhatsApp novedades, lanzamientos y ofertas. Puedes
              retirar esta autorización cuando quieras.
            </li>
          </ul>
          <p className="mt-2">No vendemos ni compartimos tus datos con terceros, salvo la transportadora para entregar tu pedido.</p>
        </section>
        <section>
          <h2 className="mb-2 text-2xl text-ink">Tus derechos</h2>
          <p>
            Puedes conocer, actualizar y rectificar tus datos, pedir que los eliminemos cuando no exista una obligación de
            conservarlos y revocar la autorización de mercadeo. Escríbenos por WhatsApp al {store.whatsappDisplay} y te
            responderemos en los plazos que establece la ley.
          </p>
        </section>
      </div>
    </div>
  );
}
