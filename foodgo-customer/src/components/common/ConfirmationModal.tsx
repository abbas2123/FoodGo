import React, { useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/useTheme";

export interface ConfirmationModalAction {
  label: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
}

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  description?: string;
  icon?:
    | string
    | React.ReactNode
    | {
        name: keyof typeof Ionicons.glyphMap;
        color?: string;
        size?: number;
      };
  primaryAction: ConfirmationModalAction;
  secondaryAction?: ConfirmationModalAction;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
  children?: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  onClose,
  loading = false,
  destructive = false,
  children,
}) => {
  const { theme, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacityAnim, scaleAnim]);

  const renderIcon = () => {
    if (!icon) return null;

    if (React.isValidElement(icon)) {
      return <View style={styles.iconContainer}>{icon}</View>;
    }

    if (typeof icon === "object" && "name" in icon) {
      const isDestructive = primaryAction?.destructive || destructive;
      const defaultColor = isDestructive ? "#DC2626" : "#C1121F";
      const defaultBg = isDestructive ? "#FEE2E2" : "rgba(193, 18, 31, 0.1)";

      return (
        <View style={[styles.iconCircle, { backgroundColor: defaultBg }]}>
          <Ionicons
            name={icon.name}
            size={icon.size || 32}
            color={icon.color || defaultColor}
          />
        </View>
      );
    }

    if (typeof icon === "string") {
      return (
        <View style={styles.emojiContainer}>
          <Text style={styles.emojiText}>{icon}</Text>
        </View>
      );
    }

    return null;
  };

  const isPrimaryDestructive = primaryAction?.destructive || destructive;
  const isPrimaryLoading = primaryAction?.loading || loading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: opacityAnim },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Close button */}
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="close"
              size={20}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </Pressable>

          {/* Icon */}
          {renderIcon()}

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: isDark ? "#F9FAFB" : "#111827" },
            ]}
          >
            {title}
          </Text>

          {/* Description */}
          {description && (
            <Text
              style={[
                styles.description,
                { color: isDark ? "#9CA3AF" : "#6B7280" },
              ]}
            >
              {description}
            </Text>
          )}

          {/* Custom Content Slot */}
          {children && <View style={styles.contentContainer}>{children}</View>}

          {/* Actions */}
          <View style={styles.actionColumn}>
            {/* Primary Action Button */}
            <Pressable
              style={[
                styles.primaryBtn,
                isPrimaryDestructive
                  ? styles.destructiveBtn
                  : styles.brandBtn,
                isPrimaryLoading && styles.disabledBtn,
              ]}
              onPress={primaryAction.onPress}
              disabled={isPrimaryLoading}
            >
              {isPrimaryLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>{primaryAction.label}</Text>
              )}
            </Pressable>

            {/* Secondary Action Button */}
            {secondaryAction && (
              <Pressable
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: isDark ? "#374151" : "#F3F4F6" },
                ]}
                onPress={secondaryAction.onPress}
                disabled={isPrimaryLoading}
              >
                <Text
                  style={[
                    styles.secondaryBtnText,
                    {
                      color: secondaryAction.destructive
                        ? "#DC2626"
                        : isDark
                        ? "#E5E7EB"
                        : "#374151",
                    },
                  ]}
                >
                  {secondaryAction.label}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  cardContainer: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emojiContainer: {
    marginBottom: 16,
  },
  emojiText: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  contentContainer: {
    width: "100%",
    marginBottom: 16,
  },
  actionColumn: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBtn: {
    backgroundColor: "#C1121F",
    shadowColor: "#C1121F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  destructiveBtn: {
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
