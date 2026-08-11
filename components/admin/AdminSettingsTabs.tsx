'use client';

import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { hasAdminPermission, type AdminPermissionKey } from '../../lib/adminPermissions';

type SettingsTab = 'mitarbeiter' | 'profil';

const settingsTabs: Array<{
  href: string;
  key: SettingsTab;
  label: string;
  permissionKey: AdminPermissionKey;
}> = [
  { href: '/admin/einstellungen?tab=profil', key: 'profil', label: 'Mein Profil', permissionKey: 'settings.profile' },
  { href: '/admin/einstellungen?tab=mitarbeiter', key: 'mitarbeiter', label: 'Mitarbeiter', permissionKey: 'settings.employees' },
];

export default function AdminSettingsTabs({ currentTab }: { currentTab: SettingsTab }) {
  const { profile } = useAuth();

  const visibleTabs = settingsTabs.filter((tab) => hasAdminPermission(profile, tab.permissionKey));
  if (visibleTabs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {visibleTabs.map((tab) => (
        <Link
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            currentTab === tab.key
              ? 'bg-[linear-gradient(180deg,#6e5a46_0%,#594737_100%)] text-stone-100'
              : 'border border-stone-300 bg-white text-slate-700 hover:border-stone-400'
          }`}
          href={tab.href}
          key={tab.key}
          scroll={false}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
