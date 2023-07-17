import { IBM_Plex_Mono } from "next/font/google";
import Providers from "~/components/Providers";
import { Sidebar } from "~/components/Sidebar";

import "~/styles/globals.css";
import { LayoutWithSidebar } from "~/components/LayoutWithSidebar";
import Script from "next/script";
import { env } from "~/env.mjs";

const plex = IBM_Plex_Mono({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-plex",
});

export const metadata = {
  title: "Mythroller",
  description: "Generate characters for your TTRPG",
};

// export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plex.variable}`}>
      <body>
        <Providers>
          <LayoutWithSidebar sidebar={<Sidebar />}>
            {children}
          </LayoutWithSidebar>
        </Providers>

        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${env.GA_MEASUREMENT_ID}`}
        />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
  
            gtag('config', '${env.GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
