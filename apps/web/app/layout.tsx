import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import SmoothScroll from '@/components/smooth-scroll'
import 'lenis/dist/lenis.css'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-tabular',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgentDesk — Proof, not promises.',
  description:
    "The marketplace for BNB Chain's 200,000+ on-chain agents. Every track record verifiable. Every hire capped. Every agent revocable in one tap.",
  icons: { icon: '/logo.png' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <SmoothScroll />
        {children}
      </body>
    </html>
  )
}
