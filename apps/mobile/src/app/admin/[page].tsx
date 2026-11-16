import { useLocalSearchParams } from 'expo-router';
import { AdminScreen } from '@/screens/rolePages';

export default function AdminPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <AdminScreen page={String(page ?? '')} />;
}
