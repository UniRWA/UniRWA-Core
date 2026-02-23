import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import PageTransition from "@/components/PageTransition";
import { Toaster } from "@/components/ui/sonner";

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
        <Providers>
          <Navbar />
          <main>
            <PageTransition>{children}</PageTransition>
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
