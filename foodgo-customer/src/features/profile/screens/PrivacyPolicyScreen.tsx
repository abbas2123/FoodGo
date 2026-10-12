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

export default function PrivacyPolicyScreen() {
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
          Privacy Policy
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
          FoodiGo (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy describes how your personal information is collected, used, and safeguarded when you use our mobile application and related delivery services.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          1. Information We Collect
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          We collect only the information necessary to provide, fulfill, and secure your food delivery orders:
        </Text>
        <View style={styles.bulletItem}>
          <Text style={[styles.bulletPoint, { color: theme.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>
            <Text style={styles.boldText}>Phone Number & Authentication:</Text> Collected during login and registration to send one-time verification codes (OTPs) and secure your account.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={[styles.bulletPoint, { color: theme.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>
            <Text style={styles.boldText}>Foreground Location & Addresses:</Text> Collected with your explicit in-app consent to locate nearby restaurants, estimate delivery times, and calculate accurate courier routing. Background location tracking is not used.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={[styles.bulletPoint, { color: theme.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>
            <Text style={styles.boldText}>Profile Information & Photos:</Text> Optional display name, email address, and profile photo selected from your device photo library.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={[styles.bulletPoint, { color: theme.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>
            <Text style={styles.boldText}>Orders & Invoices:</Text> Details of dishes ordered, order totals, restaurant details, delivery timestamps, and order status histories.
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Text style={[styles.bulletPoint, { color: theme.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>
            <Text style={styles.boldText}>Payment Tokens:</Text> Online transactions are processed by certified third-party payment gateways (such as Razorpay). FoodiGo never stores full credit card numbers or sensitive payment credentials on our servers.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          2. How We Use Your Information
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          Your data is used to:
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • Process, cook, and deliver your food orders.
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • Authenticate your identity and protect against fraudulent access.
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • Send transactional notifications regarding order status updates.
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • Comply with statutory tax, invoicing, and commercial accounting regulations.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          3. Third-Party Service Providers
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          We share data strictly on a need-to-know basis with trusted infrastructure partners:
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • <Text style={styles.boldText}>SMS Providers (Twilio):</Text> For dispatching OTP login verification messages.
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • <Text style={styles.boldText}>Payment Gateways (Razorpay):</Text> For tokenized transaction processing.
        </Text>
        <Text style={[styles.listItem, { color: theme.text }]}>
          • <Text style={styles.boldText}>Mapping Services (Google Maps):</Text> For road geocoding and routing directions.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          4. Data Retention & Account Deletion
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          In full compliance with Google Play Store and data protection regulations:
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          You have the right to delete your account at any time directly within the application via <Text style={styles.boldText}>Profile &gt; Delete Account</Text>.
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          When your account is deleted, your personal profile data, authentication credentials, phone number linkage, saved addresses, search history, notifications, and payment tokens are permanently deleted. Completed order invoice numbers and tax totals are anonymized and retained strictly to satisfy statutory commercial accounting requirements.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          5. Contact & Privacy Inquiries
        </Text>
        <Text style={[styles.paragraph, { color: theme.text }]}>
          For questions about your data or to submit a privacy inquiry, please reach out through the in-app support channel or contact the FoodiGo Data Protection Officer at your configured support email.
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
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingLeft: 4,
  },
  bulletPoint: {
    fontSize: 18,
    lineHeight: 20,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "600",
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
    paddingLeft: 8,
  },
});
