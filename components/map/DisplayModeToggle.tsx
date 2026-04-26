import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MapDisplayMode } from '../../types';
import { ColorTheme } from '../../theme/colors';
import { DroneProfile } from '../../types';

interface DisplayModeToggleProps {
  mode: MapDisplayMode;
  onModeChange: (mode: MapDisplayMode) => void;
  profiles: DroneProfile[];
  activeDroneId: string;
  onSelectDrone: (id: string) => void;
  dronePickerOpen: boolean;
  onToggleDronePicker: () => void;
  colors: ColorTheme;
}

export default function DisplayModeToggle({
  mode,
  onModeChange,
  profiles,
  activeDroneId,
  onSelectDrone,
  dronePickerOpen,
  onToggleDronePicker,
  colors,
}: DisplayModeToggleProps) {
  const activeDrone = profiles.find((p) => p.id === activeDroneId) ?? profiles[0];

  return (
    <View style={styles.wrapper}>
      {/* Mode toggle */}
      <View style={[styles.segmented, { borderColor: colors.border }]}>
        {(['raw', 'score'] as MapDisplayMode[]).map((m, i) => {
          const isActive = m === mode;
          return (
            <TouchableOpacity
              key={m}
              style={[
                styles.segmentItem,
                i === 0 && { borderRightWidth: 1, borderRightColor: colors.border },
                isActive && { backgroundColor: colors.tabBarActive },
              ]}
              onPress={() => onModeChange(m)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {m === 'raw' ? 'Weather' : 'Score'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Drone selector shown in score mode */}
      {mode === 'score' && (
        <TouchableOpacity
          onPress={onToggleDronePicker}
          style={[
            styles.dronePill,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="quadcopter" size={14} color={colors.tabBarActive} />
          <Text style={[styles.dronePillText, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeDrone?.name ?? 'Select drone'}
          </Text>
          <MaterialCommunityIcons
            name={dronePickerOpen ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}

      {/* Drone picker dropdown */}
      {mode === 'score' && dronePickerOpen && (
        <View
          style={[
            styles.picker,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          {profiles.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.pickerItem, { borderBottomColor: colors.border }]}
              onPress={() => onSelectDrone(p.id)}
            >
              <Text
                style={[
                  styles.pickerText,
                  { color: p.id === activeDroneId ? colors.tabBarActive : colors.textPrimary },
                ]}
              >
                {p.name}
              </Text>
              {p.id === activeDroneId && (
                <MaterialCommunityIcons name="check" size={14} color={colors.tabBarActive} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 10,
    paddingBottom: 6,
    gap: 6,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  segmentItem: {
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dronePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: 220,
  },
  dronePillText: {
    fontSize: 12,
    flex: 1,
  },
  picker: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerText: { fontSize: 13 },
});
