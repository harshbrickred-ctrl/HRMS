import { useLocalSearchParams } from 'expo-router';
import { ManagerScreen } from '@/screens/rolePages';

export default function ManagerPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <ManagerScreen page={String(page ?? '')} />;
}
