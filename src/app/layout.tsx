import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResearchFlow Agent",
  description: "Transparent multi-agent research kickoff workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="page-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
