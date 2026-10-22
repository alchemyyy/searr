import SettingsBackendSelection from '@app/components/Settings/BackendSelection';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const BackendSelectionSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);

  return (
    <SettingsLayout>
      <SettingsBackendSelection />
    </SettingsLayout>
  );
};

export default BackendSelectionSettingsPage;
