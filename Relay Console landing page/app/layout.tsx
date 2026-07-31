import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay Console",
  description: "A native macOS command center for running agent work across apps, files, and workspaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
