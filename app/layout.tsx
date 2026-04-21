import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import { AppChrome } from "@/components/app-chrome"
import { HeaderSlotProvider } from "@/components/header-slot"
import "./globals.css"

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "The Kit Room",
  description: "An editorial football kit archive connected to your Supabase catalog.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={sans.variable}>
        <HeaderSlotProvider>
          <AppChrome>{children}</AppChrome>
        </HeaderSlotProvider>
      </body>
    </html>
  )
}
