import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import { AppChrome } from "@/components/app-chrome"
import { HeaderSlotProvider } from "@/components/header-slot"
import "./globals.css"

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
})

function getMetadataBase(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL)
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`)
  }
  return new URL("http://localhost:3000")
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "The Kit Room",
  description: "An editorial football kit archive connected to your Supabase catalog.",
  openGraph: {
    title: "The Kit Room",
    description:
      "An editorial football kit archive connected to your Supabase catalog.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1024,
        height: 469,
        alt: "The Kit Room",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Kit Room",
    description:
      "An editorial football kit archive connected to your Supabase catalog.",
    images: ["/og-image.png"],
  },
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
