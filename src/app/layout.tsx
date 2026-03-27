import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIM Trace",
  description:
    "Web-native BIM authoring and review platform with 3D/2D coordination",
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
