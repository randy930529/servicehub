import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ServiceHub API",
  description: "Minimal backend for the ServiceHub services catalog.",
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
