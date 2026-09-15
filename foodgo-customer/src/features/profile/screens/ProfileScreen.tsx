import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "@/navigation/types";
import { RootState, AppDispatch } from "../../../store";
import { fetchProfileThunk, logoutThunk } from "../../../store/slices/authSlice";
import { toggleTheme } from "../../../store/slices/themeSlice";
import { toggleNotifications } from "../../../store/slices/uiSlice";
import { selectDefaultAddress } from "../../../store/slices/addressSlice";
import { useTheme } from "../../../theme/useTheme";
import type { Ionicons } from "@expo/vector-icons";

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

  // ─── Logout ────────────────────────────────────────────────────────
  const handleLogout = () => {
    dispatch(logoutThunk());
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

      console.log("Selected image:", imageUri);

      // Update your avatar state here
      setAvatar(imageUri);
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
          phone={user?.phone ?? "—"}
          avatarUri={avatar}
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

        <LogOutButton onLogout={handleLogout} />
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
});
