import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { getColors } from '../../theme/colors';

export default function TabLayout() {
  const { t } = useTranslation();
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const colors = getColors(themeOverride, systemScheme);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.forecast'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="drones"
        options={{
          title: t('tabs.drones'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="quadcopter" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
