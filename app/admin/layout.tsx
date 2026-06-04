import type { ReactNode } from 'react';
import ProtectedAreaLayout from '../../components/ProtectedAreaLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedAreaLayout
      navSections={[
        {
          links: [
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/nachrichten', label: 'Nachrichten', permissionKey: 'messages.read' },
          ],
        },
        {
          label: 'Hinzufuegen',
          links: [
            { href: '/admin/firma', label: 'Firma', permissionKey: 'companies.create' },
            { href: '/admin/immobilie', label: 'Immobilie', permissionKey: 'properties.create' },
            { href: '/admin/mieter', label: 'Mieter', permissionKey: 'tenants.create' },
            { href: '/admin/personen', label: 'Dritte & Dienstleister', permissionKey: 'contacts.create' },
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
