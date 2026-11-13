import type { Metadata, Viewport } from "next";
import "@fontsource-variable/jost";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "./globals.css";
import { store } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: `${store.name} · ${store.tagline}`,
    template: `%s · ${store.name}`,
  },
  description: store.description,
  openGraph: {
    title: `${store.name} · ${store.tagline}`,
    description: store.description,
    locale: "es_CO",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
