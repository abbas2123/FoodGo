import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationServer,
} from "@/store/slices/notificationsSlice";
import { AppNotification } from "@/api/notifications/notificationsApi";
import { useTheme } from "@/theme/useTheme";

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notifications.items);
  const loading = useAppSelector((state) => state.notifications.loading);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);

  useEffect(() => {
    if (visible) {
      dispatch(fetchNotifications());
    }
  }, [visible, dispatch]);

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      dispatch(markAllNotificationsAsRead());
    }
  };

  const handleItemPress = (item: AppNotification) => {
    if (!item.isRead) {
      dispatch(markNotificationAsRead(item.id));
    }
  };

  const handleDeleteItem = (id: number) => {
    dispatch(deleteNotificationServer(id));
  };

  const getIconName = (type: string) => {
    switch (type?.toUpperCase()) {
      case "ORDER_UPDATE":
        return "fast-food";
      case "PROMO":
      case "OFFER":
        return "pricetag";
      case "DELIVERY":
        return "bicycle";
      case "SYSTEM":
      default:
        return "notifications";
    }
  };

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
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: theme.surface,
                  borderTopColor: theme.border,
                  borderTopWidth: isDark ? 1 : 0,
                },
              ]}
            >
              <View
                style={[
                  styles.header,
                  { borderBottomColor: theme.border },
                ]}
              >
                <View style={styles.titleRow}>
                  <Ionicons name="notifications" size={24} color="#C1121F" />
                  <Text style={[styles.headerTitle, { color: theme.text }]}>
                    Notifications
                  </Text>
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.headerActions}>
                  {unreadCount > 0 && (
                    <Pressable onPress={handleMarkAllAsRead} style={styles.markReadBtn}>
                      <Text style={styles.markReadText}>Mark all read</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color={theme.text} />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {loading && notifications.length === 0 ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#C1121F" />
                    <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
                      Loading notifications...
                    </Text>
                  </View>
                ) : notifications.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="notifications-off-outline" size={48} color={theme.muted} />
                    <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                      No notifications yet
                    </Text>
                  </View>
                ) : (
                  notifications.map((item) => (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: isDark ? theme.card : "#F9FAFB",
                          borderColor: theme.border,
                        },
                        !item.isRead && [
                          styles.itemCardUnread,
                          {
                            backgroundColor: isDark
                              ? theme.primaryLight
                              : "#FFF5F5",
                            borderColor: isDark ? theme.border : "#FED7D7",
                          },
                        ],
                      ]}
                      onPress={() => handleItemPress(item)}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor: isDark
                              ? item.isRead
                                ? theme.surface
                                : "rgba(193, 18, 31, 0.25)"
                              : "#FFEBEB",
                          },
                        ]}
                      >
                        <Ionicons
                          name={getIconName(item.type)}
                          size={20}
                          color="#C1121F"
                        />
                      </View>

                      <View style={styles.itemTextContainer}>
                        <View style={styles.itemHeader}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>
                            {item.title}
                          </Text>
                          <Text style={[styles.itemTime, { color: theme.muted }]}>
                            {formatRelativeTime(item.createdAt)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.itemMessage,
                            { color: theme.secondaryText },
                          ]}
                        >
                          {item.message}
                        </Text>
                      </View>

                      <View style={styles.rightActions}>
                        {!item.isRead && <View style={styles.unreadDot} />}
                        <Pressable
                          hitSlop={8}
                          onPress={() => handleDeleteItem(item.id)}
                          style={styles.deleteBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.muted} />
                        </Pressable>
                      </View>
                    </Pressable>
                  ))
                )}
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
    maxHeight: "80%",
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
    fontSize: 20,
    fontWeight: "700",
    color: "#261818",
  },
  badge: {
    backgroundColor: "#C1121F",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markReadText: {
    fontSize: 13,
    color: "#C1121F",
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  itemCardUnread: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FED7D7",
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFEBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTextContainer: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  itemTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  itemMessage: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  rightActions: {
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    paddingTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C1121F",
  },
  deleteBtn: {
    padding: 2,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
  },
});
