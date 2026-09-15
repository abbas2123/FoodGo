import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../theme/useTheme";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  fetchAddresses,
  deleteAddress,
  setDefaultAddress,
  selectAllAddresses,
  selectAddressLoading,
  selectAddressError,
  selectAddressInitialized,
} from "@/store/slices/addressSlice";
import type { Address } from "@/api/address/addressApi";
import AddAddress from "./addAddress";

interface Props {
  visible: boolean;
  closeModal: (value: boolean) => void;
}

const LABEL_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Work: "briefcase",
};

function getLabelIcon(label: string): keyof typeof Ionicons.glyphMap {
  return LABEL_ICON[label] ?? "location";
}

function formatAddress(addr: Address): string {
  const parts = [
    addr.address_line1,
    addr.address_line2,
    addr.landmark,
    addr.city,
    addr.state,
    addr.postal_code,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function SavedAddress({ visible, closeModal }: Props) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();

  const addresses = useAppSelector(selectAllAddresses);
  const isLoading = useAppSelector(selectAddressLoading);
  const error = useAppSelector(selectAddressError);
  const initialized = useAppSelector(selectAddressInitialized);

  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Fetch addresses only when modal opens
  useEffect(() => {
    if (visible) {
      dispatch(fetchAddresses());
    }
  }, [visible, dispatch]);

  const handleSetDefault = async (addr: Address) => {
    if (addr.is_default) return;
    try {
      await dispatch(setDefaultAddress(addr.id)).unwrap();
    } catch {
      Alert.alert("Error", "Failed to set default address. Please try again.");
    }
  };

  const handleEdit = (addr: Address) => {
    setEditingAddress(addr);
    setIsAddAddressOpen(true);
  };

  const handleDelete = (addr: Address) => {
    Alert.alert(
      "Delete Address",
      `Are you sure you want to delete this ${addr.label} address?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(deleteAddress(addr.id)).unwrap();
            } catch {
              Alert.alert("Error", "Failed to delete address. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleAddNewClose = (value: boolean) => {
    setIsAddAddressOpen(value);
    if (!value) {
      setEditingAddress(null);
    }
  };

  const renderAddress = ({ item }: { item: Address }) => {
    const formattedAddr = formatAddress(item);
    return (
      <View
        style={[
          styles.addressCard,
          {
            backgroundColor: theme.background,
            borderColor: item.is_default ? theme.primary : theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: item.is_default ? theme.primaryLight : theme.skeleton },
          ]}
        >
          <Ionicons
            name={getLabelIcon(item.label)}
            size={20}
            color={item.is_default ? theme.primary : theme.secondaryText}
          />
        </View>

        <View style={styles.addressInfo}>
          <View style={styles.addressTitleRow}>
            <Text style={[styles.addressTitle, { color: theme.text }]}>
              {item.label}
            </Text>
            {item.is_default && (
              <View style={[styles.defaultBadge, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={10} color="#fff" />
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.addressText, { color: theme.secondaryText }]}
            numberOfLines={2}
          >
            {formattedAddr}
          </Text>
        </View>

        {/* Actions Menu */}
        <View style={styles.actionsColumn}>
          {!item.is_default && (
            <Pressable
              style={[styles.actionBtn, { borderColor: theme.border }]}
              onPress={() => handleSetDefault(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="star-outline" size={16} color={theme.primary} />
            </Pressable>
          )}
          <Pressable
            style={[styles.actionBtn, { borderColor: theme.border }]}
            onPress={() => handleEdit(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="pencil-outline" size={16} color={theme.secondaryText} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { borderColor: theme.border }]}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={16} color="#C1121F" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => closeModal(false)}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Saved Addresses
            </Text>
            <Pressable
              onPress={() => closeModal(false)}
              style={[styles.closeButton, { backgroundColor: theme.skeleton }]}
            >
              <Ionicons name="close" size={20} color={theme.icon} />
            </Pressable>
          </View>

          {/* Content */}
          {isLoading && !initialized ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
                Loading addresses...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="cloud-offline-outline" size={48} color={theme.muted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Could not load addresses
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondaryText }]}>
                {error}
              </Text>
              <Pressable
                style={[styles.retryBtn, { borderColor: theme.primary }]}
                onPress={() => dispatch(fetchAddresses())}
              >
                <Text style={{ color: theme.primary, fontWeight: "600" }}>Retry</Text>
              </Pressable>
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.centered}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="location-outline" size={36} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No saved addresses
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.secondaryText }]}>
                Add a delivery address to get started
              </Text>
            </View>
          ) : (
            <FlatList
              data={addresses}
              keyExtractor={(item) => item.id}
              renderItem={renderAddress}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          )}

          {/* Add New Address Button */}
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setEditingAddress(null);
              setIsAddAddressOpen(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add New Address</Text>
          </Pressable>
        </View>

        <AddAddress
          visible={isAddAddressOpen}
          closeModal={handleAddNewClose}
          editAddress={editingAddress}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 30,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 240,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 4,
  },
  list: {
    maxHeight: 380,
  },
  listContent: {
    paddingBottom: 8,
    gap: 10,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: 8,
    marginBottom: 4,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  addressText: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionsColumn: {
    gap: 6,
    alignItems: "center",
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    height: 50,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
