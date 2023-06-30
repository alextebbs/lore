import { IBM_Plex_Mono } from "next/font/google";
import Providers from "~/components/Providers";
import { Sidebar } from "~/components/Sidebar";
import { cn } from "~/utils/cn";

import "~/styles/globals.css";
import { LayoutWithSidebar } from "~/components/LayoutWithSidebar";

const plex = IBM_Plex_Mono({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-plex",
});

export const metadata = {
  title: "Mythweaver",
  description: "Generate character's for TTRPG's",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(plex.className)}>
        <Providers>
          <LayoutWithSidebar sidebar={<Sidebar />}>
            {children}
          </LayoutWithSidebar>
        </Providers>
      </body>
    </html>
  );
}
