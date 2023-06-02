import { type Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mythweaver",
  description: "Generate a character for your tabletop role-playing game.",
};

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="py-4 text-center font-heading text-2xl uppercase text-stone-700">
          Mythweaver
        </div>

        {children}
      </body>
    </html>
  );
}
