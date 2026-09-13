import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HKU MSc(BA) Course Planner",
  description: "Plan HKU MSc in Business Analytics courses, detect timetable conflicts, and track graduation requirements.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
