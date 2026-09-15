import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../store";
import { updateProfileThunk } from "../../../store/slices/authSlice";
import { useTheme } from "../../../theme/useTheme";

interface Props {
  visible: boolean;
  closeModal: (value: boolean) => void;
  name: string;
  phone: string;
}

export default function EditProfile({
  visible,
  closeModal,
  name,
  phone,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { theme, isDark } = useTheme();

  const [newName, setNewName] = useState(name);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize state whenever modal opens or props change
  useEffect(() => {
    if (visible) {
      setNewName(name);
      setErrorMessage(null);
      setLoading(false);
    }
  }, [visible, name]);

  const handleSave = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setErrorMessage("Name cannot be empty");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const resultAction = await dispatch(
        updateProfileThunk({ name: trimmedName }),
      );

      if (updateProfileThunk.fulfilled.match(resultAction)) {
        closeModal(false);
      } else {
        const errorText =
          (resultAction.payload as string) || "Failed to update profile";
        setErrorMessage(errorText);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setErrorMessage(null);
      closeModal(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Edit Profile
            </Text>

            <Pressable onPress={handleClose} disabled={loading} hitSlop={10}>
              <Text style={[styles.close, { color: theme.secondaryText }]}>✕</Text>
            </Pressable>
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#C1121F" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Name */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Name</Text>

            <TextInput
              value={newName}
              onChangeText={(text) => {
                setNewName(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter your name"
              placeholderTextColor={theme.secondaryText}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: isDark ? "#444" : "#ddd",
                  backgroundColor: isDark ? "#2A2A2A" : "#FAFAFA",
                },
              ]}
              textContentType="name"
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          {/* Phone (Verified / Read-only) */}
          <View style={styles.inputContainer}>
            <View style={styles.phoneLabelRow}>
              <Text style={[styles.label, { color: theme.text, marginBottom: 0 }]}>
                Phone
              </Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#16A34A" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <TextInput
              value={phone}
              editable={false}
              style={[
                styles.input,
                styles.readOnlyInput,
                {
                  color: theme.secondaryText,
                  borderColor: isDark ? "#333" : "#eee",
                  backgroundColor: isDark ? "#1E1E1E" : "#F3F4F6",
                },
              ]}
            />
            <Text style={[styles.helpText, { color: theme.secondaryText }]}>
              Phone number is linked to your login account.
            </Text>
          </View>

          {/* Save Button */}
          <Pressable
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </Pressable>

          {/* Cancel */}
          <Pressable
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={loading}
          >
            <Text style={[styles.cancelText, { color: theme.primary }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
  },

  close: {
    fontSize: 20,
    fontWeight: "600",
    padding: 4,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },

  errorText: {
    color: "#C1121F",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },

  inputContainer: {
    marginBottom: 18,
  },

  phoneLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },

  verifiedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 15,
  },

  readOnlyInput: {
    opacity: 0.85,
  },

  helpText: {
    fontSize: 12,
    marginTop: 6,
  },

  button: {
    height: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  cancelButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  cancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
