# 🎨 Font Configuration Guide - MLS Processor

Este documento explica cómo cambiar la fuente tipográfica para todo el sistema MLS Processor.

## 📍 Archivos a Modificar

Solo necesitas editar **2 archivos** para cambiar la fuente de toda la aplicación:

1. `app/layout.tsx` - Configuración de la fuente
2. `app/globals.css` - Variables CSS

---

## 🔧 Instrucciones Paso a Paso

### 1. Modificar `app/layout.tsx`

**Ubicación:** `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { TU_FUENTE_AQUI } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Configurar la fuente
const tuFuente = TU_FUENTE_AQUI({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-tu-variable',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "MLS Processor",
  description: "Process MLS data efficiently",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${tuFuente.variable} antialiased font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 2. Modificar `app/globals.css`

**Ubicación:** `app/globals.css` (línea 9)

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-tu-variable); /* ← Cambiar esta línea */
  --font-mono:
    ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo,
    monospace;
  /* ... resto del archivo ... */
}
```

---

## 📝 Ejemplos de Fuentes Populares

### Roboto (Material Design)

```typescript
import { Roboto } from "next/font/google";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});
```

```css
--font-sans: var(--font-roboto);
```

### Inter (Muy popular en web apps)

```typescript
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
```

```css
--font-sans: var(--font-inter);
```

### Poppins (Moderna y friendly)

```typescript
import { Poppins } from "next/font/google";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});
```

```css
--font-sans: var(--font-poppins);
```

### Open Sans (Clásica y legible)

```typescript
import { Open_Sans } from "next/font/google";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});
```

```css
--font-sans: var(--font-open-sans);
```

### Montserrat (Elegante y versátil)

```typescript
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});
```

```css
--font-sans: var(--font-montserrat);
```

---

## 🎯 Configuración Actual

**Fuente actual:** Exo 2

**Layout actual:**

```typescript
const exo = Exo_2({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-exo",
  display: "swap",
});
```

**CSS actual:**

```css
--font-sans: var(--font-exo);
```

---

## 📋 Lista de Verificación

Para cambiar la fuente correctamente:

- [ ] Importar la nueva fuente en `layout.tsx`
- [ ] Configurar la nueva fuente con sus pesos y opciones
- [ ] Actualizar la className del body con la nueva variable
- [ ] Cambiar la variable `--font-sans` en `globals.css`
- [ ] Reiniciar el servidor de desarrollo (`npm run dev`)

---

## 🌍 Dónde se Aplica la Fuente

La fuente se aplicará automáticamente a:

✅ **Toda la aplicación** (formularios, textos, botones)
✅ **Página de login**
✅ **Dashboard completo**
✅ **MLS Processor**
✅ **Componentes shadcn/ui**
✅ **Navegación y menús**
✅ **Modales y diálogos**
✅ **Tablas y resultados**

---

## 🔍 Google Fonts

Puedes explorar más fuentes en: https://fonts.google.com/

**Tip:** Usa nombres de fuentes con guiones bajos para espacios:

- "Open Sans" → `Open_Sans`
- "Exo 2" → `Exo_2`
- "Source Sans Pro" → `Source_Sans_Pro`

---

## 🚀 Reinicio Requerido

Después de cambiar la fuente:

```bash
# Detener el servidor (Ctrl+C)
# Reiniciar el servidor
npm run dev
```

¡Listo! La nueva fuente se aplicará a todo el sistema MLS Processor.
