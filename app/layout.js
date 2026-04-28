// app/layout.js
// Root layout. Wraps all pages in the rail+panel sidebar.

import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'Duraco',
  description: 'Property management platform'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
