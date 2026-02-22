import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UniRWA — Real-World Asset Marketplace",
  description:
    "The unified marketplace for tokenized real-world assets on Avalanche. Pool, trade, and earn yield on Treasury funds and bonds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-brand-cream`}>
        <Navbar />
        <main>{children}</main>
        {/* Toaster will be added when shadcn sonner/toast is wired */}
      </body>
    </html>
  );
}
