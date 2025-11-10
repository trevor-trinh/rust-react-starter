import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Rust React Starter",
  description: "A fullstack starter with Rust and React",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
