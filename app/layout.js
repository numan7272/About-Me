import "./globals.css";

export const metadata = {
  title: "Numan — 3D Portfolio Roadmap",
  description:
    "An interactive isometric journey through my path: Wirtschaftsinformatik, Gastro-Wurzeln und Quality Engineering.",
  themeColor: "#05060a",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
