import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityWalker - AI Travel Assistant",
  description: "Plan your perfect city walk with AI-powered recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
