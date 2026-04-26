import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ColorTheme } from '../../theme/colors';
import { toDateString, addDays } from '../../lib/utils/time';

interface DateHourControlsProps {
  selectedDate: string;
  selectedHour: number;
  onDateChange: (date: string) => void;
  onHourChange: (hour: number) => void;
  colors: ColorTheme;
}

const TOTAL_DAYS = 16;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DateHourControls({
  selectedDate,
  selectedHour,
  onDateChange,
  onHourChange,
  colors,
}: DateHourControlsProps) {
  const today = new Date();
  const todayStr = toDateString(today);
  const currentHour = today.getHours();

  const dates: Date[] = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(today, i));

  const hourScrollRef = useRef<ScrollView>(null);

  // Scroll hour bar to selected hour on mount
  useEffect(() => {
    if (hourScrollRef.current) {
      hourScrollRef.current.scrollTo({ x: selectedHour * HOUR_ITEM_W, animated: false });
    }
  }, []);

  const isToday = selectedDate === todayStr;

  return (
    <View>
      {/* Date strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRow}
      >
        {dates.map((d) => {
          const ds = toDateString(d);
          const isActive = ds === selectedDate;
          const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
          const dateNum = d.getDate();
          return (
            <TouchableOpacity
              key={ds}
              onPress={() => {
                onDateChange(ds);
                // If switching to today and current hour is past selectedHour, clamp
                if (ds === todayStr && selectedHour < currentHour) {
                  onHourChange(currentHour);
                }
              }}
              style={[
                styles.dateItem,
                {
                  backgroundColor: isActive ? colors.tabBarActive : colors.surface,
                  borderColor: isActive ? colors.tabBarActive : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.dayAbbr, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}
              >
                {dayLabel}
              </Text>
              <Text
                style={[styles.dayNum, { color: isActive ? '#FFFFFF' : colors.textPrimary }]}
              >
                {dateNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Hour strip */}
      <ScrollView
        ref={hourScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hourRow}
      >
        {HOURS.map((h) => {
          const isPast = isToday && h < currentHour;
          const isActive = h === selectedHour;
          return (
            <TouchableOpacity
              key={h}
              onPress={() => !isPast && onHourChange(h)}
              style={[
                styles.hourItem,
                {
                  backgroundColor: isActive
                    ? colors.tabBarActive
                    : isPast
                    ? colors.border
                    : colors.surface,
                  borderColor: isActive ? colors.tabBarActive : colors.border,
                  opacity: isPast ? 0.45 : 1,
                },
              ]}
              activeOpacity={isPast ? 1 : 0.7}
            >
              <Text
                style={[
                  styles.hourText,
                  {
                    color: isActive
                      ? '#FFFFFF'
                      : isPast
                      ? colors.textSecondary
                      : colors.textPrimary,
                  },
                ]}
              >
                {String(h).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const HOUR_ITEM_W = 38;

const styles = StyleSheet.create({
  dateRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
    flexDirection: 'row',
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayAbbr: {
    fontSize: 10,
    fontWeight: '500',
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '600',
  },
  hourRow: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 4,
    flexDirection: 'row',
  },
  hourItem: {
    width: HOUR_ITEM_W,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  hourText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
