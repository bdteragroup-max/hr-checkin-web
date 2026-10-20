import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import AppShell from "./_shell/AppShell";
import QueryProvider from "../components/QueryProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const interThaiLooped = localFont({
  src: [
    {
      path: "../../public/fonts/InterThaiLooped[wght].ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/InterThaiLooped-Italic[wght].ttf",
      style: "italic",
    },
  ],
  variable: "--font-inter-thai",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hr-checkin-web.vercel.app"),
  title: "TERA GROUP",
  description: "Leave and Attendance System",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.jpg",
    apple: "/icon.jpg",
  },
  appleWebApp: {
    capable: true,
    title: "TERA GROUP",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${inter.variable} ${interThaiLooped.variable}`}>
      <body className="antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
