import AdminEmployeeSettings from '../../../components/admin/AdminEmployeeSettings';
import AdminProfileSettings from '../../../components/admin/AdminProfileSettings';
import AdminSettingsTabs from '../../../components/admin/AdminSettingsTabs';

type SettingsTab = 'mitarbeiter' | 'profil';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: SettingsTab }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab: SettingsTab =
    resolvedSearchParams.tab === 'mitarbeiter'
      ? 'mitarbeiter'
      : 'profil';
  return (
    <div className="space-y-6">
      <AdminSettingsTabs currentTab={currentTab} />

      {currentTab === 'mitarbeiter' ? (
        <AdminEmployeeSettings />
      ) : (
        <AdminProfileSettings />
      )}
    </div>
  );
}
