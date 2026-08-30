import type { Metadata } from 'next'
import { Golos_Text } from 'next/font/google'
import AuthGuard from '@/components/AuthGuard';
import ThemeProvider, { themeBootstrapScript } from '@/components/ThemeProvider';
import './globals.css'

// Шрифт дизайн-системы TOTUS CLUB.
const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Totus Admin',
  description: 'Админ-панель Totus Club',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={golos.className}>
        <ThemeProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  )
}
