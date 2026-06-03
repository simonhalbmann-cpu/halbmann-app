import type { ReactNode } from 'react';
import ProtectedAreaLayout from '../../components/ProtectedAreaLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedAreaLayout
      navSections={[
        {
          links: [
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/nachrichten', label: 'Nachrichten' },
          ],
        },
        {
          label: 'Hinzufuegen',
          links: [
            { href: '/admin/firma', label: 'Firma' },
            { href: '/admin/immobilie', label: 'Immobilie' },
            { href: '/admin/mieter', label: 'Mieter' },
            { href: '/admin/personen', label: 'Dritte & Dienstleister' },
          ],
        },
      ]}
      requiredRole="admin"
      title="Verwaltungsbereich"
    >
      {children}
    </ProtectedAreaLayout>
  );
}
