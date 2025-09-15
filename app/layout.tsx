import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import { TRPCProvider } from "@/trpc/react"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Tachyon Mail",
  description: "Modern webmail client",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <TRPCProvider>
            <div className="min-h-screen bg-background text-foreground">{children}</div>
          </TRPCProvider>
        </Suspense>
      </body>
    </html>
  )
}
