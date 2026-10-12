import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/useTheme";

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Terms of Service
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lastUpdated, { color: theme.muted }]}>
          Effective Date: October 2026 · Version 1.0
        </Text>

        <Text style={[styles.paragraph, { color: theme.text }]}>
          Welcome to FoodiGo. By accessing or using the FoodiGo application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          1. Account Registration & Security
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          To place orders, you must register using a valid phone number verified by SMS OTP. You are responsible for maintaining the confidentiality of your session credentials and for all activities that occur under your account.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          2. Orders, Pricing & Fulfillment
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          • <Text style={styles.boldText}>Order Placement:</Text> When you place an order, you agree to pay the displayed order total, including dish prices, applicable platform fees, and delivery charges.
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          • <Text style={styles.boldText}>Restaurant Fulfillment:</Text> Menu items, ingredient availability, and preparation quality are managed by our partner restaurants.
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          • <Text style={styles.boldText}>Delivery Estimates:</Text> Stated delivery times and driver ETAs are estimates influenced by traffic, preparation delays, and weather conditions.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          3. Payments & Cancellations
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          Payments may be completed through online payment methods (UPI, Cards) or Cash on Delivery (COD). Orders may be cancelled without penalty prior to restaurant acceptance. Once food preparation begins, orders cannot be cancelled or refunded unless quality or delivery failure is verified.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          4. User Conduct
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          You agree not to use the application for unlawful activities, submit fraudulent orders, harass delivery personnel or restaurant staff, or attempt unauthorized access to application infrastructure.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          5. Account Deletion & Termination
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          You may terminate your account at any time using the Delete Account option in the Profile settings. We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent conduct.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          6. Limitation of Liability
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          To the maximum extent permitted by applicable law, FoodiGo is not liable for indirect, incidental, or consequential damages resulting from service interruptions, delivery delays, or third-party restaurant food preparation.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: "600",
  },
});
