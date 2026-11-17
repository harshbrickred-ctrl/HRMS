import { useLocalSearchParams } from 'expo-router';
import { HrScreen } from '@/screens/rolePages';

export default function HrPage() {
  const { page } = useLocalSearchParams<{ page: string }>();
  return <HrScreen page={String(page ?? '')} />;
}
