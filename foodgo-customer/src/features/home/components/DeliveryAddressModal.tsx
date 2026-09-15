import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { setDeliveryAddress, setLocation } from "@/store/slices/locationSlice";
import {
  selectAllAddresses,
  selectSelectedAddress,
  selectAddress,
} from "@/store/slices/addressSlice";
import { apiClient } from "@/api/client/apiClient";
import { API_ENDPOINTS } from "@/api/client/apiConfig";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Work: "briefcase",
};
function getSavedAddressIcon(label: string): keyof typeof Ionicons.glyphMap {
  return ICON_MAP[label] ?? "location";
}

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

interface DeliveryAddressModalProps {
  visible: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
}

export const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({
  visible,
  onClose,
  onUseCurrentLocation,
}) => {
  const dispatch = useAppDispatch();
  const currentAddress = useAppSelector(
    (state) => state.location.displayLocation || state.location.address,
  );
  const savedAddresses = useAppSelector(selectAllAddresses);
  const selectedAddress = useAppSelector(selectSelectedAddress);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setSuggestions([]);
      setIsSearching(false);
      setIsLoadingDetails(false);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [visible]);

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiClient.get(
          API_ENDPOINTS.LOCATION.AUTOCOMPLETE,
          {
            params: { query: trimmed },
          },
        );

        const data = response.data?.data ?? response.data;
        if (Array.isArray(data)) {
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectSuggestion = async (item: PlaceSuggestion) => {
    setIsLoadingDetails(true);

    try {
      const response = await apiClient.get(
        API_ENDPOINTS.LOCATION.PLACE_DETAILS,
        {
          params: { placeId: item.placeId },
        },
      );

      const details = response.data?.data ?? response.data;

      if (details && typeof details === "object" && details.latitude) {
        dispatch(setLocation(details));
        dispatch(
          setDeliveryAddress({
            address: details.displayLocation || item.description,
            label: item.mainText,
            coordinates: {
              latitude: details.latitude,
              longitude: details.longitude,
            },
          }),
        );
        onClose();
        return;
      }
    } catch {
      // Fallback below
    } finally {
      setIsLoadingDetails(false);
    }

    dispatch(
      setDeliveryAddress({
        address: item.description,
        label: item.mainText,
      }),
    );
    onClose();
  };

  const handleSelectSavedAddress = (
    addressId: string,
    addressText: string,
    label: string,
  ) => {
    dispatch(selectAddress(addressId));
    dispatch(setDeliveryAddress({ address: addressText, label }));
    onClose();
  };

  const handleUseCurrentLocation = () => {
    onUseCurrentLocation();
    onClose();
  };

  const filteredSaved = savedAddresses.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.address_line1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.city.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Ionicons name="location" size={22} color="#C1121F" />
                  <Text style={styles.headerTitle}>Select Delivery Address</Text>
                </View>

                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color="#261818" />
                </Pressable>
              </View>

              <View style={styles.searchContainer}>
                {isSearching ? (
                  <ActivityIndicator size="small" color="#C1121F" />
                ) : (
                  <Ionicons name="search" size={20} color="#9CA3AF" />
                )}
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for area, street, or landmark..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>

              {isLoadingDetails && (
                <View style={styles.loadingBanner}>
                  <ActivityIndicator size="small" color="#C1121F" />
                  <Text style={styles.loadingBannerText}>
                    Setting delivery address...
                  </Text>
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {searchQuery.trim().length >= 2 && suggestions.length > 0 && (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>SUGGESTIONS</Text>
                    {suggestions.map((item) => (
                      <Pressable
                        key={item.placeId}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSuggestion(item)}
                      >
                        <View style={styles.suggestionIconCircle}>
                          <Ionicons name="location-sharp" size={18} color="#C1121F" />
                        </View>
                        <View style={styles.suggestionTextContainer}>
                          <Text style={styles.suggestionMainText} numberOfLines={1}>
                            {item.mainText}
                          </Text>
                          {item.secondaryText ? (
                            <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                              {item.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                      </Pressable>
                    ))}
                  </View>
                )}

                {searchQuery.trim().length >= 2 && !isSearching && suggestions.length === 0 && (
                  <Pressable
                    style={styles.customAddressCard}
                    onPress={() =>
                      handleSelectSavedAddress("", searchQuery.trim(), "Delivering to")
                    }
                  >
                    <View style={styles.suggestionIconCircle}>
                      <Ionicons name="pin" size={18} color="#C1121F" />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionMainText}>
                        Deliver to "{searchQuery.trim()}"
                      </Text>
                      <Text style={styles.suggestionSecondaryText}>
                        Tap to use this custom location
                      </Text>
                    </View>
                  </Pressable>
                )}

                <Pressable
                  style={styles.currentLocationCard}
                  onPress={handleUseCurrentLocation}
                >
                  <View style={styles.gpsIconContainer}>
                    <Ionicons name="navigate" size={20} color="#C1121F" />
                  </View>
                  <View style={styles.currentLocationText}>
                    <Text style={styles.currentLocationTitle}>Use Current Location</Text>
                    <Text style={styles.currentLocationSubtitle} numberOfLines={1}>
                      {currentAddress || "Detect device GPS coordinates"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>SAVED ADDRESSES</Text>
                </View>

                {filteredSaved.map((item) => {
                  const addressText = [item.address_line1, item.city, item.state]
                    .filter(Boolean)
                    .join(", ");
                  const isSelected = selectedAddress?.id === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.addressCard,
                        isSelected && styles.addressCardSelected,
                      ]}
                      onPress={() =>
                        handleSelectSavedAddress(item.id, addressText, item.label)
                      }
                    >
                      <View style={styles.addressIconContainer}>
                        <Ionicons
                          name={getSavedAddressIcon(item.label)}
                          size={20}
                          color="#C1121F"
                        />
                      </View>

                      <View style={styles.addressInfo}>
                        <View style={styles.addressTitleRow}>
                          <Text style={styles.addressTitle}>{item.label}</Text>
                          {isSelected && (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedBadgeText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressText} numberOfLines={2}>
                          {addressText}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#261818",
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    backgroundColor: "#FFF5F5",
  },
  loadingBannerText: {
    fontSize: 13,
    color: "#C1121F",
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  suggestionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: "#6B7280",
  },
  currentLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#FFF5F5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FED7D7",
    marginVertical: 8,
    gap: 12,
  },
  gpsIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocationText: {
    flex: 1,
  },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#C1121F",
  },
  currentLocationSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  customAddressCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginVertical: 8,
    gap: 12,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
    gap: 12,
  },
  addressCardSelected: {
    borderColor: "#C1121F",
    backgroundColor: "#FFFBFB",
  },
  addressIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  selectedBadge: {
    backgroundColor: "#C1121F",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  selectedBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  addressText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
});
