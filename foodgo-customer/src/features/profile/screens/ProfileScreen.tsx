import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "@/navigation/types";
import { RootState, AppDispatch } from "../../../store";
import {
  fetchProfileThunk,
  logoutThunk,
  updateProfileThunk,
  deleteAccountThunk,
} from "../../../store/slices/authSlice";
import { toggleTheme } from "../../../store/slices/themeSlice";
import { toggleNotifications } from "../../../store/slices/uiSlice";
import { selectDefaultAddress } from "../../../store/slices/addressSlice";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";

import ProfileHeader from "../components/ProfileHeader";
import QuickActionGrid, { QuickAction } from "../components/QuickActionGrid";
import QuickAddressCard from "../components/QuickAddressCard";
import SettingsSection, { SettingItem } from "../components/SettingsSection";
import LogOutButton from "../components/LogOutButton";
import EditProfile from "../components/ediProfile";
import SavedAddress from "@/features/profile/components/savedAdress";
import PaymentMethodsModal from "../components/PaymentMethodsModal";

function getAddressIconName(label: string): keyof typeof Ionicons.glyphMap {
  if (label === "Home") return "home-outline";
  if (label === "Work") return "briefcase-outline";
  return "location-outline";
}

function formatAddressShort(addr: {
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
}): string {
  const parts = [addr.address_line1, addr.city, addr.state].filter(Boolean);
  return parts.join(", ");
}
export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, isDark } = useTheme();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isOpen, SetisOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch latest profile from backend on mount
  useEffect(() => {
    dispatch(fetchProfileThunk());
  }, [dispatch]);

  // ─── Auth ──────────────────────────────────────────────────────────
  const user = useSelector((state: RootState) => state.auth.user);
  const defaultAddress = useSelector(selectDefaultAddress);
  type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

  const navigation = useNavigation<NavigationProp>();
  // ─── UI preferences ────────────────────────────────────────────────
  const notificationsEnabled = useSelector(
    (state: RootState) => state.ui.notificationsEnabled,
  );

  // ─── Quick actions ─────────────────────────────────────────────────
  const quickActions: QuickAction[] = [
    {
      id: "orders",
      icon: "receipt-outline",
      title: "My Orders",
      subtitle: "Past & ongoing",
      onPress: () => {
        navigation.navigate("Orders");
      },
    },

    {
      id: "addresses",
      icon: "location-outline",
      title: "Addresses",
      subtitle: "Saved locations",
      onPress: () => {
        setIsAddressOpen(true);
      },
    },

    {
      id: "favorites",
      icon: "heart-outline",
      title: "Favorites",
      subtitle: "Loved meals",
      onPress: () => {
        navigation.navigate("Fav");
      },
    },

    {
      id: "payments",
      icon: "card-outline",
      title: "Payments",
      subtitle: "Cards & wallets",
      onPress: () => {
        setIsPaymentOpen(true);
      },
    },
  ];

  // ─── Preferences ───────────────────────────────────────────────────
  const preferenceItems: SettingItem[] = [
    {
      id: "notifications",
      type: "toggle",
      icon: "notifications-outline",
      title: "Push Notifications",
      value: notificationsEnabled,
      onToggle: () => dispatch(toggleNotifications()),
    },
    {
      id: "language",
      type: "chevron",
      icon: "globe-outline",
      title: "Language",
      value: "English",
      onPress: () => {},
    },
    {
      id: "darkMode",
      type: "toggle",
      icon: "moon-outline",
      title: "Dark Mode",
      // ✅ Connected to real Redux themeSlice state
      value: isDark,
      onToggle: () => dispatch(toggleTheme()),
    },
  ];

  // ─── Help & Support ────────────────────────────────────────────────
  const helpItems: SettingItem[] = [
    {
      id: "faq",
      type: "chevron",
      icon: "help-circle-outline",
      title: "FAQ",
      onPress: () => {},
    },
    {
      id: "support",
      type: "chevron",
      icon: "headset-outline",
      title: "Contact Support",
      onPress: () => {},
    },
    {
      id: "report",
      type: "chevron",
      icon: "warning-outline",
      title: "Report a Problem",
      onPress: () => {},
    },
  ];

  // ─── Legal & Policies ──────────────────────────────────────────────
  const legalItems: SettingItem[] = [
    {
      id: "privacy",
      type: "chevron",
      icon: "shield-checkmark-outline",
      title: "Privacy Policy",
      onPress: () => {
        navigation.navigate("PrivacyPolicy");
      },
    },
    {
      id: "terms",
      type: "chevron",
      icon: "document-text-outline",
      title: "Terms of Service",
      onPress: () => {
        navigation.navigate("TermsOfService");
      },
    },
  ];

  // ─── Logout ────────────────────────────────────────────────────────
  const handleLogout = () => {
    dispatch(logoutThunk());
  };

  // ─── Delete Account ────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your FoodiGo account? All your personal profile information, saved addresses, and payment methods will be erased. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              const resultAction = await dispatch(deleteAccountThunk());
              if (deleteAccountThunk.fulfilled.match(resultAction)) {
                Alert.alert(
                  "Account Deleted",
                  "Your account and associated personal data have been successfully deleted.",
                );
              } else {
                const errorMsg =
                  (resultAction.payload as string) ||
                  "Unable to delete account at this time. Please check your internet connection or try again.";
                Alert.alert("Deletion Error", errorMsg);
              }
            } catch (err: any) {
              Alert.alert(
                "Deletion Error",
                err?.message ||
                  "An unexpected error occurred while deleting your account.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const onEditPress = async () => {
    // Ask for gallery permission
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      alert("Permission to access photos is required.");
      return;
    }

    // Open gallery
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      setAvatar(imageUri);
      dispatch(updateProfileThunk({ profileImageUrl: imageUri }));
    }
  };

  return (
    <View
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.heading, { color: theme.text }]}>Profile</Text>

        <ProfileHeader
          name={user?.name ?? null}
          email={user?.email ?? ''}
          phone={user?.phone ?? null}
          avatarUri={avatar || user?.profileImageUrl || null}
          onEditPress={onEditPress}
          openEditModal={SetisOpen}
        />
        <EditProfile
          visible={isOpen}
          closeModal={SetisOpen}
          name={user?.name ?? ""}
          phone={user?.phone ?? ""}
        />
        <QuickActionGrid actions={quickActions} />
        <SavedAddress
          visible={isAddressOpen}
          closeModal={setIsAddressOpen}
        />
        <PaymentMethodsModal
          visible={isPaymentOpen}
          closeModal={setIsPaymentOpen}
        />
        <QuickAddressCard
          label={defaultAddress ? defaultAddress.label : "Delivery Address"}
          address={
            defaultAddress
              ? formatAddressShort(defaultAddress)
              : "No address saved — tap to add one"
          }
          iconName={getAddressIconName(defaultAddress?.label ?? "")}
          onPress={() => setIsAddressOpen(true)}
        />

        <SettingsSection title="Preferences" items={preferenceItems} />

        <SettingsSection title="Help & Support" items={helpItems} />

        <SettingsSection title="Legal & Policies" items={legalItems} />

        <LogOutButton onLogout={handleLogout} />

        {/* Delete Account Action */}
        <View style={styles.deleteAccountContainer}>
          <Pressable
            style={[
              styles.deleteButton,
              { borderColor: theme.border },
              isDeleting && styles.disabledDeleteButton,
            ]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            accessibilityLabel="Delete Account"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#E63946" />
            ) : (
              <View style={styles.deleteRow}>
                <Ionicons name="trash-outline" size={18} color="#E63946" />
                <Text style={styles.deleteText}>Delete Account</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 36,
  },
  heading: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  deleteAccountContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  disabledDeleteButton: {
    opacity: 0.6,
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteText: {
    color: "#E63946",
    fontSize: 14,
    fontWeight: "600",
  },
});
