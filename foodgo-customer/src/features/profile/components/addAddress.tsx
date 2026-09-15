import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../theme/useTheme";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import {
  addAddress,
  updateAddress,
} from "@/store/slices/addressSlice";
import type { Address, CreateAddressDto, UpdateAddressDto } from "@/api/address/addressApi";
import {
  requestForegroundPermission,
  reverseGeocodeCoordinates,
  fetchPlaceSuggestions,
  fetchPlaceDetails,
  geocodeAddress,
  type PlaceSuggestion,
} from "@/services/location/locationService";
import * as Location from "expo-location";

type LabelPreset = "Home" | "Work" | "Other";
const LABEL_PRESETS: LabelPreset[] = ["Home", "Work", "Other"];

const LABEL_ICONS: Record<LabelPreset, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Work: "briefcase-outline",
  Other: "location-outline",
};

export type LocationSource = "gps" | "geocoded" | "none";

interface Props {
  visible: boolean;
  closeModal: (value: boolean) => void;
  /** If provided, the modal is in edit mode */
  editAddress?: Address | null;
}

function parseCoord(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : Number(val);
  return isNaN(num) ? null : num;
}

function formatCoordinate(val: unknown): string {
  const num = parseCoord(val);
  return num !== null ? num.toFixed(5) : "";
}

function getPreset(label: string): LabelPreset {
  const upper = label as LabelPreset;
  if (LABEL_PRESETS.includes(upper)) return upper;
  return "Other";
}

export default function AddAddress({ visible, closeModal, editAddress }: Props) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();

  const isEdit = Boolean(editAddress);

  // Form state
  const [selectedPreset, setSelectedPreset] = useState<LabelPreset>("Home");
  const [customLabel, setCustomLabel] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  // Location source tracking
  const [locationSource, setLocationSource] = useState<LocationSource>("none");

  // Loading states
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // User notifications / errors
  const [locationError, setLocationError] = useState<string | null>(null);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track initial values for edit mode to detect location field edits
  const initialAddressRef = useRef<{
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  }>({
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
  });

  // Reset or initialize form when modal opens
  useEffect(() => {
    if (visible) {
      if (editAddress) {
        const preset = getPreset(editAddress.label);
        setSelectedPreset(preset);
        setCustomLabel(preset === "Other" ? editAddress.label : "");
        setAddressLine1(editAddress.address_line1 || "");
        setAddressLine2(editAddress.address_line2 || "");
        setLandmark(editAddress.landmark || "");
        setCity(editAddress.city || "");
        setState(editAddress.state || "");
        setPostalCode(editAddress.postal_code || "");
        setCountry(editAddress.country || "India");

        const parsedLat = parseCoord(editAddress.latitude);
        const parsedLng = parseCoord(editAddress.longitude);

        setLatitude(parsedLat);
        setLongitude(parsedLng);
        setLocationSource(parsedLat !== null && parsedLng !== null ? "geocoded" : "none");
        setIsDefault(editAddress.is_default);

        initialAddressRef.current = {
          addressLine1: editAddress.address_line1 || "",
          city: editAddress.city || "",
          state: editAddress.state || "",
          postalCode: editAddress.postal_code || "",
        };
      } else {
        setSelectedPreset("Home");
        setCustomLabel("");
        setAddressLine1("");
        setAddressLine2("");
        setLandmark("");
        setCity("");
        setState("");
        setPostalCode("");
        setCountry("India");
        setLatitude(null);
        setLongitude(null);
        setLocationSource("none");
        setIsDefault(false);
        initialAddressRef.current = {
          addressLine1: "",
          city: "",
          state: "",
          postalCode: "",
        };
      }

      setLocationError(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setIsDetectingLocation(false);
      setIsSearchingAddress(false);
      setIsSaving(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [visible, editAddress]);

  const effectiveLabel =
    selectedPreset === "Other"
      ? customLabel.trim() || "Other"
      : selectedPreset;

  // Handle addressLine1 change + autocomplete debounced search
  const handleAddressLine1Change = (text: string) => {
    setAddressLine1(text);
    setLocationError(null);

    // If coordinates were from GPS or previous geocode, mark as none if user edited main address
    if (locationSource !== "none") {
      setLocationSource("none");
      setLatitude(null);
      setLongitude(null);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingAddress(false);
      return;
    }

    setIsSearchingAddress(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await fetchPlaceSuggestions(trimmed);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);
  };

  // Handle selecting an autocomplete suggestion
  const handleSelectSuggestion = async (item: PlaceSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setIsSearchingAddress(true);
    setLocationError(null);

    try {
      const details = await fetchPlaceDetails(item.placeId);
      const parsedLat = parseCoord(details?.latitude);
      const parsedLng = parseCoord(details?.longitude);

      if (parsedLat !== null && parsedLng !== null) {
        setLatitude(parsedLat);
        setLongitude(parsedLng);
        setLocationSource("geocoded");

        // Populate fields
        setAddressLine1(item.mainText || details?.displayLocation || details?.formattedAddress || "");
        if (item.secondaryText) {
          setAddressLine2(item.secondaryText);
        } else if (details?.locality) {
          setAddressLine2(details.locality);
        }

        if (details?.city) setCity(details.city);
        if (details?.state) setState(details.state);
        if (details?.postalCode) setPostalCode(details.postalCode);
        if (details?.country) setCountry(details.country);
      } else {
        // Fallback: populate text and mark for on-save geocoding
        setAddressLine1(item.description || item.mainText);
        setLocationError("Couldn't retrieve exact place coordinates. We'll locate it upon save.");
      }
    } catch {
      setLocationError("Failed to fetch place details. Please review your address.");
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Handle GPS detection
  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationError(null);
    setShowSuggestions(false);

    try {
      const status = await requestForegroundPermission();
      if (status !== "granted") {
        setLocationError("Location permission is disabled. You can still enter your address manually.");
        return;
      }

      let position: Location.LocationObject;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (posErr) {
        console.warn("[Location] getCurrentPositionAsync error:", posErr);
        setLocationError("Unable to detect your current location. You can enter your address manually.");
        return;
      }

      const exactLat = parseCoord(position.coords.latitude);
      const exactLng = parseCoord(position.coords.longitude);

      if (exactLat !== null && exactLng !== null) {
        // Preserve exact GPS coordinates
        setLatitude(exactLat);
        setLongitude(exactLng);
        setLocationSource("gps");
      }

      // Reverse geocode to populate readable address fields
      const result = await reverseGeocodeCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );

      if (result.street || result.name) {
        setAddressLine1(result.street || result.name || "");
      } else if (result.locality) {
        setAddressLine1(result.locality);
      } else if (result.displayLocation) {
        setAddressLine1(result.displayLocation);
      }

      if (result.locality && (result.street || result.name)) {
        setAddressLine2(result.locality);
      }

      if (result.city) setCity(result.city);
      if (result.state) setState(result.state);
      if (result.postalCode) setPostalCode(result.postalCode);
      if (result.country) setCountry(result.country);
    } catch (err) {
      setLocationError("Unable to detect your current location. You can enter your address manually.");
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Basic field validation
  const validateFields = (): string | null => {
    if (!addressLine1.trim()) return "Address Line 1 is required.";
    if (!city.trim()) return "City is required.";
    if (!state.trim()) return "State is required.";
    if (!postalCode.trim()) return "PIN Code is required.";
    return null;
  };

  // Main save handler
  const handleSave = async () => {
    if (isSaving || isDetectingLocation) return;

    const fieldError = validateFields();
    if (fieldError) {
      Alert.alert("Missing Information", fieldError);
      return;
    }

    setIsSaving(true);
    setLocationError(null);

    let activeLat = parseCoord(latitude);
    let activeLng = parseCoord(longitude);
    let activeSource = locationSource;

    // Check if coordinates need to be resolved (manual entry without picking autocomplete suggestion)
    if (activeLat === null || activeLng === null || activeSource === "none") {
      const fullAddressString = [
        addressLine1.trim(),
        addressLine2.trim(),
        landmark.trim(),
        city.trim(),
        state.trim(),
        postalCode.trim(),
        country.trim() || "India",
      ]
        .filter(Boolean)
        .join(", ");

      const geocoded = await geocodeAddress(fullAddressString);
      const geoLat = parseCoord(geocoded?.latitude);
      const geoLng = parseCoord(geocoded?.longitude);

      if (geoLat !== null && geoLng !== null) {
        activeLat = geoLat;
        activeLng = geoLng;
        activeSource = "geocoded";
        setLatitude(activeLat);
        setLongitude(activeLng);
        setLocationSource("geocoded");
      } else {
        setIsSaving(false);
        Alert.alert(
          "Location Required",
          "We couldn't locate this address. Please select an address from the suggestions or try using your current location."
        );
        return;
      }
    }

    const finalLat = parseCoord(activeLat);
    const finalLng = parseCoord(activeLng);

    // Safety guard: coordinates must never be null, undefined, or 0
    if (finalLat === null || finalLng === null) {
      setIsSaving(false);
      Alert.alert(
        "Location Required",
        "We couldn't locate this address. Please select an address from the suggestions or try using your current location."
      );
      return;
    }

    try {
      if (isEdit && editAddress) {
        const payload: UpdateAddressDto = {
          label: effectiveLabel,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || undefined,
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          country: country.trim() || "India",
          latitude: finalLat,
          longitude: finalLng,
          is_default: isDefault,
        };
        console.log("Updating address:", payload);
        await dispatch(updateAddress({ id: editAddress.id, dto: payload })).unwrap();
      } else {
        const payload: CreateAddressDto = {
          label: effectiveLabel,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || undefined,
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          country: country.trim() || "India",
          latitude: finalLat,
          longitude: finalLng,
          is_default: isDefault,
        };
        console.log("Creating address:", payload);
        await dispatch(addAddress(payload)).unwrap();
      }

      closeModal(false);
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        (Array.isArray(err?.message) ? err.message.join(", ") : err?.message) ||
        "Failed to save address. Please check your details and try again.";

      Alert.alert("Save Failed", serverMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !isSaving && closeModal(false)}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {isEdit ? "Edit Address" : "Add Address"}
            </Text>
            <Pressable
              onPress={() => !isSaving && closeModal(false)}
              style={[styles.closeBtn, { backgroundColor: theme.skeleton }]}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={theme.icon} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* OPTION 1: Use Current Location */}
            <Pressable
              style={[
                styles.detectButton,
                { borderColor: theme.primary, backgroundColor: theme.primaryLight },
              ]}
              onPress={handleDetectLocation}
              disabled={isDetectingLocation || isSaving}
            >
              {isDetectingLocation ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="navigate-circle-outline" size={22} color={theme.primary} />
              )}
              <View style={styles.detectTextGroup}>
                <Text style={[styles.detectButtonTitle, { color: theme.primary }]}>
                  {isDetectingLocation ? "Detecting your location..." : "Use Current Location"}
                </Text>
                <Text style={[styles.detectButtonSubtitle, { color: theme.secondaryText }]}>
                  Detect your current address via GPS
                </Text>
              </View>
            </Pressable>

            {/* Location Notice / Error Banner */}
            {locationError ? (
              <View style={[styles.errorBanner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Ionicons name="information-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{locationError}</Text>
              </View>
            ) : null}

            {/* Coordinates Status Badge */}
            {latitude !== null &&
            longitude !== null &&
            parseCoord(latitude) !== null &&
            parseCoord(longitude) !== null ? (
              <View
                style={[
                  styles.coordBadge,
                  {
                    backgroundColor:
                      locationSource === "gps" ? theme.primaryLight : theme.skeleton,
                  },
                ]}
              >
                <Ionicons
                  name={locationSource === "gps" ? "navigate" : "checkmark-circle"}
                  size={14}
                  color={locationSource === "gps" ? theme.primary : theme.text}
                />
                <Text
                  style={[
                    styles.coordText,
                    { color: locationSource === "gps" ? theme.primary : theme.text },
                  ]}
                >
                  {locationSource === "gps"
                    ? `GPS: ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`
                    : `Pinpointed: ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`}
                </Text>
              </View>
            ) : null}

            {/* SECTION DIVIDER */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.muted }]}>
                OR ENTER ADDRESS MANUALLY
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Address Type Selector */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Address Type</Text>
            <View style={styles.presetRow}>
              {LABEL_PRESETS.map((preset) => {
                const active = selectedPreset === preset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => setSelectedPreset(preset)}
                    style={[
                      styles.presetChip,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? theme.primary : theme.card,
                      },
                    ]}
                  >
                    <Ionicons
                      name={LABEL_ICONS[preset]}
                      size={14}
                      color={active ? "#fff" : theme.secondaryText}
                    />
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: active ? "#fff" : theme.secondaryText },
                      ]}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedPreset === "Other" && (
              <View style={styles.inputContainer}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Custom Label</Text>
                <TextInput
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="e.g. Gym, Parents, Hotel..."
                  placeholderTextColor={theme.muted}
                  style={inputStyle}
                  editable={!isSaving}
                />
              </View>
            )}

            {/* Address Line 1 with Autocomplete Suggestions */}
            <View style={styles.inputContainer}>
              <View style={styles.labelWithIndicator}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  Address / Flat, Building, Street <Text style={{ color: theme.primary }}>*</Text>
                </Text>
                {isSearchingAddress && (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 6 }} />
                )}
              </View>

              <TextInput
                value={addressLine1}
                onChangeText={handleAddressLine1Change}
                placeholder="Search or enter House/Street"
                placeholderTextColor={theme.muted}
                style={inputStyle}
                editable={!isSaving}
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <View
                  style={[
                    styles.suggestionsContainer,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  {suggestions.map((item) => (
                    <Pressable
                      key={item.placeId}
                      style={({ pressed }) => [
                        styles.suggestionItem,
                        { borderBottomColor: theme.border },
                        pressed && { backgroundColor: theme.skeleton },
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={theme.primary}
                        style={styles.suggestionIcon}
                      />
                      <View style={styles.suggestionTextContainer}>
                        <Text
                          style={[styles.suggestionMainText, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {item.mainText}
                        </Text>
                        {item.secondaryText ? (
                          <Text
                            style={[styles.suggestionSecondaryText, { color: theme.secondaryText }]}
                            numberOfLines={1}
                          >
                            {item.secondaryText}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Address Line 2 */}
            <View style={styles.inputContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                Apartment / Floor / Locality
              </Text>
              <TextInput
                value={addressLine2}
                onChangeText={setAddressLine2}
                placeholder="Area, Colony, Locality (optional)"
                placeholderTextColor={theme.muted}
                style={inputStyle}
                editable={!isSaving}
              />
            </View>

            {/* Landmark */}
            <View style={styles.inputContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Landmark</Text>
              <TextInput
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Nearby landmark (optional)"
                placeholderTextColor={theme.muted}
                style={inputStyle}
                editable={!isSaving}
              />
            </View>

            {/* City + State Row */}
            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  City <Text style={{ color: theme.primary }}>*</Text>
                </Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor={theme.muted}
                  style={inputStyle}
                  editable={!isSaving}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  State <Text style={{ color: theme.primary }}>*</Text>
                </Text>
                <TextInput
                  value={state}
                  onChangeText={setState}
                  placeholder="State"
                  placeholderTextColor={theme.muted}
                  style={inputStyle}
                  editable={!isSaving}
                />
              </View>
            </View>

            {/* PIN Code */}
            <View style={styles.inputContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                PIN Code <Text style={{ color: theme.primary }}>*</Text>
              </Text>
              <TextInput
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="6-digit PIN code"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                maxLength={10}
                style={inputStyle}
                editable={!isSaving}
              />
            </View>

            {/* Set as Default Toggle */}
            <Pressable
              style={styles.defaultRow}
              onPress={() => !isSaving && setIsDefault((v) => !v)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: theme.primary,
                    backgroundColor: isDefault ? theme.primary : "transparent",
                  },
                ]}
              >
                {isDefault && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={[styles.defaultLabel, { color: theme.text }]}>
                Set as default delivery address
              </Text>
            </Pressable>

            {/* Save Button */}
            <Pressable
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    isSaving || isDetectingLocation ? theme.muted : theme.primary,
                },
              ]}
              onPress={handleSave}
              disabled={isSaving || isDetectingLocation}
            >
              {isSaving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.saveButtonText}>Saving address...</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEdit ? "Update Address" : "Save Address"}
                </Text>
              )}
            </Pressable>

            <View style={styles.bottomSpace} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "92%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  detectButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12,
  },
  detectTextGroup: {
    flex: 1,
  },
  detectButtonTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  detectButtonSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: "#DC2626",
    fontWeight: "500",
  },
  coordBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  coordText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  presetRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputContainer: {
    marginBottom: 14,
    position: "relative",
  },
  labelWithIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },
  rowInputs: {
    flexDirection: "row",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  suggestionsContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionIcon: {
    marginRight: 10,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  suggestionSecondaryText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  saveButton: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  bottomSpace: {
    height: 24,
  },
});
