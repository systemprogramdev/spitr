import type { Metadata } from "next";
import { Share_Tech_Mono, Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPrompt } from "@/components/NotificationPrompt";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mono",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
});

const rajdhani = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "SPITr",
  description: "The cyberpunk microblogging platform. Spit your thoughts into the void.",
  metadataBase: new URL("https://spitr.wtf"),
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "SPITr",
    description: "The cyberpunk microblogging platform. Spit your thoughts into the void.",
    url: "https://spitr.wtf",
    siteName: "SPITr",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SPITr - Cyberpunk Microblogging",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPITr",
    description: "The cyberpunk microblogging platform. Spit your thoughts into the void.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${shareTechMono.variable} ${orbitron.variable} ${rajdhani.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00ff88" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SPITr" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body data-theme="terminal" data-scanlines="true" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('spitr-ui-settings');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed.state && parsed.state.theme) {
                      document.body.setAttribute('data-theme', parsed.state.theme);
                    }
                    if (parsed.state && typeof parsed.state.scanlines === 'boolean') {
                      document.body.setAttribute('data-scanlines', parsed.state.scanlines.toString());
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          {children}
          <InstallPrompt />
          <NotificationPrompt />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
