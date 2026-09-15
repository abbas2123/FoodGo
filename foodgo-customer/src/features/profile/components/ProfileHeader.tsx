import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../theme/useTheme";

interface Props {
  name: string | null;
  phone: string;
  avatarUri?: string | null;
  onEditPress?: () => void;
  openEditModal: (value: boolean) => void;
}

export default function ProfileHeader({
  name,
  phone,
  avatarUri,
  onEditPress,
  openEditModal,
}: Props) {
  const { theme } = useTheme();

  const initials = (name ?? phone)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
      <View style={styles.avatarContainer}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View
            style={[styles.avatarFallback, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <Pressable style={styles.editAvatarButton} onPress={onEditPress}>
          <Ionicons name="pencil" size={14} color="#fff" />
        </Pressable>
      </View>

      <Text style={[styles.name, { color: theme.text }]}>
        {name ?? "Guest"}
      </Text>
      <Text style={[styles.phone, { color: theme.secondaryText }]}>
        {phone}
      </Text>

      <Pressable
        style={[
          styles.editProfileButton,
          { backgroundColor: theme.primaryLight },
        ]}
        onPress={() => openEditModal(true)}
      >
        <Text style={[styles.editProfileText, { color: theme.primary }]}>
          Edit Profile
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#eee",
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  editAvatarButton: {
    position: "absolute",
    right: -2,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#C1121F",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2,
  },
  phone: {
    fontSize: 12,
    marginTop: 4,
  },
  editProfileButton: {
    marginTop: 13,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editProfileText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
