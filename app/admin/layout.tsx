import type { ReactNode } from 'react';
import ProtectedAreaLayout from '../../components/ProtectedAreaLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedAreaLayout
      navSections={[
        {
          links: [
            { href: '/admin', label: 'Dashboard' },
          ],
        },
        {
          label: 'Hinzufuegen',
          links: [
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
