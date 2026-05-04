import "./globals.css";

export const metadata = {
  title: "Numan Yesil — 3D Portfolio",
  description:
    "Interactive 3D portfolio of Numan Yesil — Software Engineer, QA, and Builder. Business Informatics at HAW Kiel.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#03040a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#03040a] text-zinc-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
