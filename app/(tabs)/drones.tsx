import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDroneStore } from '../../store/droneStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getColors } from '../../theme/colors';
import { DroneProfile } from '../../types';

type FormState = Omit<DroneProfile, 'id' | 'isPreset'>;

const EMPTY_FORM: FormState = {
  name: 'Custom Drone',
  maxWindSpeed10m: 30,
  maxWindSpeed80m: 38,
  maxWindSpeed120m: 38,
  maxGustSpeed: 42,
  minTemperature: -10,
  maxTemperature: 40,
  maxHumidity: 85,
  optimalTempMin: 5,
  optimalTempMax: 30,
};

export default function DronesScreen() {
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const hideDronePresets = useSettingsStore((s) => s.hideDronePresets);
  const colors = getColors(themeOverride, systemScheme);
  const insets = useSafeAreaInsets();

  const profiles = useDroneStore((s) => s.profiles);
  const activeDroneId = useDroneStore((s) => s.activeDroneId);
  const setActiveDrone = useDroneStore((s) => s.setActiveDrone);
  const addProfile = useDroneStore((s) => s.addProfile);
  const updateProfile = useDroneStore((s) => s.updateProfile);
  const deleteProfile = useDroneStore((s) => s.deleteProfile);
  const duplicatePreset = useDroneStore((s) => s.duplicatePreset);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const scrollRef = useRef<ScrollView>(null);
  const fieldPositions = useRef<Record<string, number>>({});

  function scrollToField(label: string) {
    const y = fieldPositions.current[label] ?? 0;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    }, 200);
  }

  const presets = profiles.filter((p) => p.isPreset);
  const customs = profiles.filter((p) => !p.isPreset);
  const activeProfile = profiles.find((p) => p.id === activeDroneId) ?? null;
  const activePresetHidden = hideDronePresets && activeProfile?.isPreset;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }

  function openEdit(profile: DroneProfile) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      maxWindSpeed10m: profile.maxWindSpeed10m,
      maxWindSpeed80m: profile.maxWindSpeed80m,
      maxWindSpeed120m: profile.maxWindSpeed120m,
      maxGustSpeed: profile.maxGustSpeed,
      minTemperature: profile.minTemperature,
      maxTemperature: profile.maxTemperature,
      maxHumidity: profile.maxHumidity,
      optimalTempMin: profile.optimalTempMin,
      optimalTempMax: profile.optimalTempMax,
    });
    setModalVisible(true);
  }

  function saveForm() {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Please enter a drone name.');
      return;
    }
    if (editingId) {
      updateProfile(editingId, { ...form });
    } else {
      const newProfile: DroneProfile = {
        id: `custom-${Date.now()}`,
        isPreset: false,
        ...form,
      };
      addProfile(newProfile);
    }
    setModalVisible(false);
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert('Delete drone', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteProfile(id),
      },
    ]);
  }

  function setNum(field: keyof FormState, text: string) {
    const n = parseFloat(text);
    setForm((f) => ({ ...f, [field]: isNaN(n) ? 0 : n }));
  }

  function renderPreset(item: DroneProfile) {
    const isActive = item.id === activeDroneId;
    return (
      <View
        key={item.id}
        style={[
          styles.profileRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
          isActive && { borderLeftWidth: 3, borderLeftColor: colors.tabBarActive },
        ]}
      >
        <TouchableOpacity style={styles.profileTouchable} onPress={() => setActiveDrone(item.id)} onLongPress={() => {
          Alert.alert(item.name, 'Duplicate as custom profile?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Duplicate', onPress: () => duplicatePreset(item.id) },
          ]);
        }}>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>{item.name}</Text>
              <View style={[styles.presetBadge, { backgroundColor: colors.border }]}>
                <Text style={[styles.presetBadgeText, { color: colors.textSecondary }]}>Preset</Text>
              </View>
            </View>
            <Text style={[styles.profileSpec, { color: colors.textSecondary }]}>
              Max wind: {item.maxWindSpeed80m} km/h · Gust: {item.maxGustSpeed} km/h
            </Text>
          </View>
          {isActive && <MaterialCommunityIcons name="check-circle" size={20} color={colors.tabBarActive} />}
        </TouchableOpacity>
      </View>
    );
  }

  function renderCustom(item: DroneProfile) {
    const isActive = item.id === activeDroneId;
    return (
      <View
        key={item.id}
        style={[
          styles.profileRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
          isActive && { borderLeftWidth: 3, borderLeftColor: colors.tabBarActive },
        ]}
      >
        <TouchableOpacity style={styles.profileTouchable} onPress={() => setActiveDrone(item.id)}>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>{item.name}</Text>
            <Text style={[styles.profileSpec, { color: colors.textSecondary }]}>
              Max wind: {item.maxWindSpeed80m} km/h · Gust: {item.maxGustSpeed} km/h
            </Text>
          </View>
          <View style={styles.profileActions}>
            {isActive && <MaterialCommunityIcons name="check-circle" size={20} color={colors.tabBarActive} />}
            <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item.id, item.name)}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#F44336" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Screen header */}
      <View style={[styles.titleBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Drone Profiles</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.tabBarActive }]} onPress={openCreate}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView>
        {!hideDronePresets && presets.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Presets</Text>
            {presets.map(renderPreset)}
          </>
        )}

        {customs.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Custom</Text>
            {customs.map(renderCustom)}
          </>
        )}

        {activePresetHidden && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}> 
            {activeProfile?.name} is still selected, but built-in presets are hidden in Settings.
          </Text>
        )}

        {!hideDronePresets && presets.length > 0 && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}> 
            Long-press a preset to duplicate it as a custom profile.
          </Text>
        )}

        {hideDronePresets && customs.length === 0 && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}> 
            Built-in DJI presets are hidden. Create a custom profile or re-enable presets in Settings.
          </Text>
        )}
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modal, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'android' ? 'padding' : undefined}
        >
          <View style={[
            styles.modalHeader,
            { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top > 0 ? insets.top + 8 : 16 },
          ]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingId ? 'Edit Drone' : 'New Drone'}
            </Text>
            <TouchableOpacity onPress={saveForm}>
              <Text style={[styles.modalSave, { color: colors.tabBarActive }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.modalBody, { paddingBottom: Math.max(40, insets.bottom + 16) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            <FormField label="Name" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <SectionDivider label="Wind Limits (km/h)" colors={colors} />
            <NumField label="Max Wind at 10m" value={form.maxWindSpeed10m} onChange={(t) => setNum('maxWindSpeed10m', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <NumField label="Max Wind at 80m" value={form.maxWindSpeed80m} onChange={(t) => setNum('maxWindSpeed80m', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <NumField label="Max Wind at 120m" value={form.maxWindSpeed120m} onChange={(t) => setNum('maxWindSpeed120m', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <NumField label="Max Gust at 80m" value={form.maxGustSpeed} onChange={(t) => setNum('maxGustSpeed', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <SectionDivider label="Temperature (°C)" colors={colors} />
            <NumField label="Min Temperature" value={form.minTemperature} onChange={(t) => setNum('minTemperature', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <NumField label="Max Temperature" value={form.maxTemperature} onChange={(t) => setNum('maxTemperature', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <NumField label="Optimal Temp Min" value={form.optimalTempMin} onChange={(t) => setNum('optimalTempMin', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <NumField label="Optimal Temp Max" value={form.optimalTempMax} onChange={(t) => setNum('optimalTempMax', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
            <SectionDivider label="Other" colors={colors} />
            <NumField label="Max Humidity (%)" value={form.maxHumidity} onChange={(t) => setNum('maxHumidity', t)} colors={colors} onFocused={scrollToField} fieldPositions={fieldPositions} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FormField({ label, value, onChangeText, colors, onFocused, fieldPositions }: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  colors: any;
  onFocused: (label: string) => void;
  fieldPositions: React.MutableRefObject<Record<string, number>>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[formStyles.row, { borderBottomColor: colors.border }]}
      onLayout={(e) => { fieldPositions.current[label] = e.nativeEvent.layout.y; }}
    >
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          formStyles.input,
          { color: colors.textPrimary, borderColor: focused ? colors.tabBarActive : colors.border },
        ]}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        onFocus={() => { setFocused(true); onFocused(label); }}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

function NumField({ label, value, onChange, colors, onFocused, fieldPositions }: {
  label: string;
  value: number;
  onChange: (t: string) => void;
  colors: any;
  onFocused: (label: string) => void;
  fieldPositions: React.MutableRefObject<Record<string, number>>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[formStyles.row, { borderBottomColor: colors.border }]}
      onLayout={(e) => { fieldPositions.current[label] = e.nativeEvent.layout.y; }}
    >
      <Text style={[formStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={onChange}
        keyboardType="numeric"
        selectTextOnFocus
        style={[
          formStyles.input,
          { color: colors.textPrimary, borderColor: focused ? colors.tabBarActive : colors.border },
        ]}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        onFocus={() => { setFocused(true); onFocused(label); }}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

function SectionDivider({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[formStyles.sectionDivider, { color: colors.textSecondary, borderTopColor: colors.border }]}>{label}</Text>
  );
}

const formStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14, flex: 1 },
  input: {
    fontSize: 15,
    textAlign: 'right',
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  sectionDivider: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 20, fontWeight: '700' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileRow: {
    marginBottom: 1,
  },
  profileTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { fontSize: 15, fontWeight: '500' },
  presetBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  presetBadgeText: { fontSize: 10, fontWeight: '600' },
  profileSpec: { fontSize: 12, marginTop: 3 },
  profileActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { padding: 4 },
  hint: { fontSize: 12, textAlign: 'center', padding: 16, marginTop: 8 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalCancel: { fontSize: 15 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalSave: { fontSize: 15, fontWeight: '600' },
  modalBody: { paddingBottom: 40 },
});
