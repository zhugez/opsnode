import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsNode — Yu Control Center",
  description: "3D operations dashboard for multi-agent command and control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
