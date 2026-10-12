import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useTheme } from "@/theme/useTheme";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationServer,
  clearAllNotificationsServer,
} from "@/store/slices/notificationsSlice";
import { AppNotification } from "@/api/notifications/notificationsApi";

function getNotificationIcon(
  type: string,
): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  switch (type) {
    case "ORDER_UPDATE":
      return { name: "receipt-outline", color: "#C1121F", bg: "#FFF0F0" };
    case "PROMO":
      return { name: "pricetag-outline", color: "#7C3AED", bg: "#F5F0FF" };
    case "DELIVERY":
      return { name: "bicycle-outline", color: "#059669", bg: "#F0FFF9" };
    default:
      return { name: "notifications-outline", color: "#2563EB", bg: "#EFF6FF" };
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const dispatch = useAppDispatch();
  const { theme, isDark } = useTheme();

  const { items, unreadCount, loading, error } = useAppSelector(
    (state) => state.notifications,
  );

  const load = useCallback(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = (id: number) => {
    dispatch(markNotificationAsRead(id));
  };

  const handleDelete = (id: number) => {
    dispatch(deleteNotificationServer(id));
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsAsRead());
  };

  const handleClearAll = () => {
    dispatch(clearAllNotificationsServer());
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: item.isRead
              ? theme.card
              : isDark
              ? "#1A0F0F"
              : "#FFF8F8",
            borderColor: item.isRead
              ? isDark
                ? "#2C2C2C"
                : "#F0F0F0"
              : "#FFD7D7",
          },
        ]}
        onPress={() => {
          if (!item.isRead) handleMarkRead(item.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {/* Unread dot */}
        {!item.isRead && <View style={styles.unreadDot} />}

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text
              style={[
                styles.title,
                { color: theme.text },
                !item.isRead && styles.titleBold,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[styles.time, { color: theme.muted }]}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
          <Text
            style={[styles.message, { color: theme.muted }]}
            numberOfLines={2}
          >
            {item.message}
          </Text>
        </View>

        {/* Delete */}
        <Pressable
          onPress={() => handleDelete(item.id)}
          hitSlop={12}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel="Delete notification"
        >
          <Ionicons name="close" size={16} color={theme.muted} />
        </Pressable>
      </Pressable>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <View>
        <Text style={[styles.heading, { color: theme.text }]}>
          Notifications
        </Text>
        {unreadCount > 0 && (
          <Text style={[styles.subheading, { color: theme.muted }]}>
            {unreadCount} unread
          </Text>
        )}
      </View>
      {items.length > 0 && (
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              style={styles.actionBtn}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-done-outline" size={15} color="#C1121F" />
              <Text style={styles.actionBtnText}>Mark all read</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleClearAll}
            style={styles.actionBtn}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={15} color="#C1121F" />
            <Text style={styles.actionBtnText}>Clear all</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const ListEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? "#1A0F0F" : "#FFF0F0" }]}>
          <Ionicons name="notifications-off-outline" size={52} color="#C1121F" />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          No notifications yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.muted }]}>
          Order updates and promotions will appear here
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C1121F" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={<ListEmpty />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              colors={["#C1121F"]}
              tintColor="#C1121F"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {error && !loading && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD7D7",
    backgroundColor: "#FFF0F0",
  },
  actionBtnText: {
    fontSize: 11,
    color: "#C1121F",
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 14,
    left: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#C1121F",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    flex: 1,
    marginRight: 6,
  },
  titleBold: {
    fontWeight: "700",
  },
  time: {
    fontSize: 11,
    flexShrink: 0,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteBtn: {
    marginLeft: 8,
    alignSelf: "flex-start",
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBanner: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#C1121F",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: "#fff",
    fontSize: 13,
    flex: 1,
  },
});
