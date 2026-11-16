import { useLocalSearchParams } from 'expo-router';
import { ExecScreen } from '@/screens/rolePages';

export default function ExecPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <ExecScreen page={String(page ?? '')} />;
}
