import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthScreenProps } from "../../../navigation/types";
import { Button } from "../../../components/common/Button";
import { spacing, typography, radius } from "../../../theme";
import { authApi } from "../../../api/auth/authApi";
import { useTheme } from "../../../theme/useTheme";

export const PhoneNumberScreen: React.FC<AuthScreenProps<"PhoneNumber">> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmedPhone = phoneNumber.trim();
    if (trimmedPhone.length < 6) {
      setErrorMessage("Please enter a valid phone number (at least 6 digits).");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await authApi.sendOtp(trimmedPhone);
      navigation.navigate("OtpVerification", { phoneNumber: trimmedPhone });
    } catch (error: any) {
      const msg =
        error?.message || "Failed to send verification code. Please try again.";
      setErrorMessage(msg);
      Alert.alert("Unable to Send Code", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: theme.primary }]}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            Enter your phone number
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            We'll send you a verification code to confirm your number.
          </Text>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme.inputBackground,
                borderColor: errorMessage ? "#EF4444" : theme.border,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="+91 1234567898"
              placeholderTextColor={theme.muted}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoFocus
              editable={!loading}
            />
          </View>

          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={phoneNumber.trim().length < 6 || loading}
            loading={loading}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: "space-between",
  },
  header: {
    height: 44,
    justifyContent: "center",
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    ...typography.body,
    fontSize: 18,
    minHeight: 44,
  },
  errorText: {
    ...typography.caption,
    color: "#EF4444",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  footer: {
    width: "100%",
    paddingBottom: spacing.md,
  },
});

export default PhoneNumberScreen;
