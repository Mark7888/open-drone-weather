import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocationStore, GPS_LOCATION } from '../store/locationStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import { getColors } from '../theme/colors';
import { searchLocations, GeocodingResult } from '../lib/api/openMeteo';
import { SavedLocation } from '../types';
import * as Location from 'expo-location';

let searchTimer: ReturnType<typeof setTimeout> | null = null;

export default function LocationSearchScreen() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const themeOverride = useSettingsStore((s) => s.themeOverride);
  const colors = getColors(themeOverride, systemScheme);

  const saved = useLocationStore((s) => s.saved);
  const active = useLocationStore((s) => s.active);
  const setActive = useLocationStore((s) => s.setActive);
  const addSaved = useLocationStore((s) => s.addSaved);
  const removeSaved = useLocationStore((s) => s.removeSaved);
  const updateSavedName = useLocationStore((s) => s.updateSavedName);
  const updateGPSCoords = useLocationStore((s) => s.updateGPSCoords);
  const fetchWeather = useWeatherStore((s) => s.fetch);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (searchTimer) clearTimeout(searchTimer);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer = setTimeout(async () => {
      const res = await searchLocations(query);
      setResults(res);
      setSearching(false);
    }, 400);
  }, [query]);

  async function selectGPS() {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const gpsLoc: SavedLocation = { ...GPS_LOCATION };
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        gpsLoc.lat = pos.coords.latitude;
        gpsLoc.lon = pos.coords.longitude;
      }
      setActive(gpsLoc);
      fetchWeather(gpsLoc);
      router.back();
    } catch {
      setActive(GPS_LOCATION);
      router.back();
    } finally {
      setGpsLoading(false);
    }
  }

  function selectResult(result: GeocodingResult) {
    const loc: SavedLocation = {
      id: `geo-${result.id}`,
      customName: null,
      placeName: result.name + (result.admin1 ? `, ${result.admin1}` : ''),
      countryCode: result.country_code,
      lat: result.latitude,
      lon: result.longitude,
      isGPS: false,
    };

    Alert.alert(
      loc.placeName,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use without saving',
          onPress: () => {
            setActive(loc);
            fetchWeather(loc);
            router.back();
          },
        },
        {
          text: 'Save & use',
          onPress: () => {
            addSaved(loc);
            setActive(loc);
            fetchWeather(loc);
            router.back();
          },
        },
      ]
    );
  }

  function selectSaved(loc: SavedLocation) {
    setActive(loc);
    fetchWeather(loc);
    router.back();
  }

  function promptDelete(id: string, name: string) {
    Alert.alert('Remove location', `Remove "${name}" from saved locations?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSaved(id) },
    ]);
  }

  function startEdit(loc: SavedLocation) {
    setEditingId(loc.id);
    setEditName(loc.customName ?? '');
  }

  function commitEdit(id: string) {
    updateSavedName(id, editName.trim() || null);
    setEditingId(null);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search for a location…"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" color={colors.tabBarActive} />}
        </View>
      </View>

      <FlatList
        data={query.trim() ? results : []}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* GPS row */}
            <TouchableOpacity
              style={[styles.gpsRow, { borderBottomColor: colors.border, opacity: gpsLoading ? 0.6 : 1 }]}
              onPress={selectGPS}
              disabled={gpsLoading}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.tabBarActive} />
              <View style={styles.gpsTextContainer}>
                <Text style={[styles.gpsPrimary, { color: colors.textPrimary }]}>My Location (GPS)</Text>
                <Text style={[styles.gpsSecondary, { color: colors.textSecondary }]}>
                  {gpsLoading ? 'Getting location…' : 'Use current location'}
                </Text>
              </View>
              {gpsLoading ? (
                <ActivityIndicator size="small" color={colors.tabBarActive} />
              ) : active?.isGPS ? (
                <MaterialCommunityIcons name="check" size={18} color={colors.tabBarActive} />
              ) : null}
            </TouchableOpacity>

            {/* Search results or saved header */}
            {query.trim() ? (
              results.length === 0 && !searching ? (
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>No results found</Text>
              ) : null
            ) : (
              saved.length > 0 && (
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Saved Locations</Text>
              )
            )}

            {/* Saved locations (shown when not searching) */}
            {!query.trim() && saved.map((loc) => (
              <SavedRow
                key={loc.id}
                loc={loc}
                isActive={active?.id === loc.id}
                colors={colors}
                editing={editingId === loc.id}
                editName={editName}
                onEditNameChange={setEditName}
                onSelect={() => selectSaved(loc)}
                onEdit={() => startEdit(loc)}
                onEditCommit={() => commitEdit(loc.id)}
                onDelete={() => promptDelete(loc.id, loc.customName ?? loc.placeName)}
              />
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.resultRow, { borderBottomColor: colors.border }]}
            onPress={() => selectResult(item)}
          >
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.textSecondary} />
            <View style={styles.resultTextContainer}>
              <Text style={[styles.resultPrimary, { color: colors.textPrimary }]}>
                {item.name}{item.admin1 ? `, ${item.admin1}` : ''}, {item.country}
              </Text>
              <Text style={[styles.resultSecondary, { color: colors.textSecondary }]}>
                {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </KeyboardAvoidingView>
  );
}

function SavedRow({
  loc, isActive, colors, editing, editName, onEditNameChange,
  onSelect, onEdit, onEditCommit, onDelete,
}: {
  loc: SavedLocation;
  isActive: boolean;
  colors: any;
  editing: boolean;
  editName: string;
  onEditNameChange: (v: string) => void;
  onSelect: () => void;
  onEdit: () => void;
  onEditCommit: () => void;
  onDelete: () => void;
}) {
  const displayPrimary = loc.customName ?? loc.placeName;
  const displaySecondary = loc.customName ? loc.placeName : null;

  return (
    <View style={[styles.savedRow, { borderBottomColor: colors.border }]}>
      <TouchableOpacity style={styles.savedTouchable} onPress={onSelect} onLongPress={onEdit}>
        {editing ? (
          <TextInput
            value={editName}
            onChangeText={onEditNameChange}
            onBlur={onEditCommit}
            onSubmitEditing={onEditCommit}
            autoFocus
            style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.tabBarActive }]}
          />
        ) : (
          <View style={styles.savedTextContainer}>
            <Text style={[styles.savedPrimary, { color: colors.textPrimary }]}>{displayPrimary}</Text>
            {displaySecondary && (
              <Text style={[styles.savedSecondary, { color: colors.textSecondary }]}>{displaySecondary}</Text>
            )}
            <Text style={[styles.savedCoords, { color: colors.textSecondary }]}>
              {loc.lat.toFixed(3)}, {loc.lon.toFixed(3)}
            </Text>
          </View>
        )}
        {isActive && !editing && (
          <MaterialCommunityIcons name="check" size={18} color={colors.tabBarActive} />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#F44336" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gpsTextContainer: { flex: 1 },
  gpsPrimary: { fontSize: 15, fontWeight: '500' },
  gpsSecondary: { fontSize: 12, marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultTextContainer: { flex: 1 },
  resultPrimary: { fontSize: 15 },
  resultSecondary: { fontSize: 12, marginTop: 2 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  savedTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  savedTextContainer: { flex: 1 },
  savedPrimary: { fontSize: 15 },
  savedSecondary: { fontSize: 12, marginTop: 2 },
  savedCoords: { fontSize: 11, marginTop: 1 },
  deleteBtn: { padding: 14 },
  editInput: {
    flex: 1,
    fontSize: 15,
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
});
