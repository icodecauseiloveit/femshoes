import { store } from "@/lib/config";
import { WhatsAppIcon } from "./icons";

export function WhatsAppButton() {
  const text = encodeURIComponent(`Hola ${store.name}, quiero más información.`);
  return (
    <a
      href={`https://wa.me/${store.whatsapp}?text=${text}`}
      target="_blank"
      rel="noopener"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex size-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:scale-105"
    >
      <WhatsAppIcon width={28} height={28} />
    </a>
  );
}
