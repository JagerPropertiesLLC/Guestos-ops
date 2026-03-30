import './globals.css'

export const metadata = {
  title: 'GuestOS Ops',
  description: 'Casitas cleaning schedule and operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
