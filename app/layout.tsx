import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/lib/config/env-server";

import "./globals.css";

export const metadata: Metadata = {
  title: "SmartDesk AI",
  description: "Repository foundation for the SmartDesk AI platform.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
