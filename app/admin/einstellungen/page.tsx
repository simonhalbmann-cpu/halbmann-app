import AdminAiSettings from '../../../components/admin/AdminAiSettings';
import AdminEmployeeSettings from '../../../components/admin/AdminEmployeeSettings';
import AdminLetterTemplateSettings from '../../../components/admin/AdminLetterTemplateSettings';
import AdminMailboxSettings from '../../../components/admin/AdminMailboxSettings';
import AdminProfileSettings from '../../../components/admin/AdminProfileSettings';
import AdminSettingsTabs from '../../../components/admin/AdminSettingsTabs';
import AdminSignatureSettings from '../../../components/admin/AdminSignatureSettings';

type SettingsTab = 'brief' | 'ki' | 'mitarbeiter' | 'postfach' | 'profil' | 'signaturen';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: SettingsTab }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab: SettingsTab =
    resolvedSearchParams.tab === 'brief'
      ? 'brief'
      : resolvedSearchParams.tab === 'signaturen'
      ? 'signaturen'
      : resolvedSearchParams.tab === 'mitarbeiter'
      ? 'mitarbeiter'
      : resolvedSearchParams.tab === 'profil'
      ? 'profil'
      : resolvedSearchParams.tab === 'ki'
        ? 'ki'
        : 'postfach';
  return (
    <div className="space-y-6">
      <AdminSettingsTabs currentTab={currentTab} />

      {currentTab === 'brief' ? (
        <AdminLetterTemplateSettings />
      ) : currentTab === 'profil' ? (
        <AdminProfileSettings />
      ) : currentTab === 'mitarbeiter' ? (
        <AdminEmployeeSettings />
      ) : currentTab === 'signaturen' ? (
        <div className="space-y-6">
          <AdminSignatureSettings />
          <AdminMailboxSettings mode="layout" />
        </div>
      ) : currentTab === 'ki' ? (
        <AdminAiSettings />
      ) : (
        <AdminMailboxSettings mode="credentials" />
      )}
    </div>
  );
}
