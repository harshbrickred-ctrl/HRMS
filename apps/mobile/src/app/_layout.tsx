import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { EssToast } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';
import { EssDataProvider } from '@/mock/EssDataContext';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <AuthProvider>
      <EssDataProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <EssToast />
      </EssDataProvider>
    </AuthProvider>
  );
}
