import type { Metadata } from 'next'
import AntdRegistry from '@/components/AntdRegistry'
import './globals.css'

export const metadata: Metadata = {
  title: 'Homie',
  description: 'Manage your shared home',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
}
