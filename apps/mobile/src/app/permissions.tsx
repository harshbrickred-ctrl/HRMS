import { MyAccess } from '@/components/MyAccess';
import { Screen } from '@/components/ui';

export default function PermissionsScreen() {
  return (
    <Screen title="My permissions" back>
      <MyAccess />
    </Screen>
  );
}
