import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MapLayer } from '../../types';
import { LAYER_META, ALL_LAYERS } from '../../lib/utils/mapColors';
import { ColorTheme } from '../../theme/colors';

interface LayerSelectorProps {
  selected: MapLayer;
  onSelect: (layer: MapLayer) => void;
  colors: ColorTheme;
}

export default function LayerSelector({ selected, onSelect, colors }: LayerSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {ALL_LAYERS.map((layer) => {
        const meta = LAYER_META[layer];
        const isActive = layer === selected;
        return (
          <TouchableOpacity
            key={layer}
            onPress={() => onSelect(layer)}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? colors.tabBarActive : colors.surface,
                borderColor: isActive ? colors.tabBarActive : colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={meta.icon as any}
              size={15}
              color={isActive ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.pillText,
                { color: isActive ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
