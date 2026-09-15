import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setNotificationCount } from "@/store/slices/uiSlice";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: "order" | "offer" | "system";
}

const NOTIFICATIONS_DATA: NotificationItem[] = [
  {
    id: "1",
    title: "Order Delivered",
    message: "Your order from The Burger House has arrived. Enjoy your meal!",
    time: "10m ago",
    unread: true,
    type: "order",
  },
  {
    id: "2",
    title: "50% Off Flash Sale",
    message: "Use code FOODIGO50 to get 50% off on your next delicious order!",
    time: "2h ago",
    unread: true,
    type: "offer",
  },
  {
    id: "3",
    title: "Welcome to FoodiGo!",
    message: "Discover the best local restaurants and fast delivery around you.",
    time: "1d ago",
    unread: false,
    type: "system",
  },
];

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [notifications, setNotifications] = React.useState(NOTIFICATIONS_DATA);

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    dispatch(setNotificationCount(0));
  };

  const getIconName = (type: NotificationItem["type"]) => {
    switch (type) {
      case "order":
        return "fast-food";
      case "offer":
        return "pricetag";
      case "system":
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
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Ionicons name="notifications" size={24} color="#C1121F" />
                  <Text style={styles.headerTitle}>Notifications</Text>
                </View>

                <View style={styles.headerActions}>
                  <Pressable onPress={handleMarkAllAsRead} style={styles.markReadBtn}>
                    <Text style={styles.markReadText}>Mark all read</Text>
                  </Pressable>
                  <Pressable onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color="#261818" />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {notifications.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No notifications yet</Text>
                  </View>
                ) : (
                  notifications.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemCard,
                        item.unread && styles.itemCardUnread,
                      ]}
                    >
                      <View style={styles.iconContainer}>
                        <Ionicons
                          name={getIconName(item.type)}
                          size={20}
                          color="#C1121F"
                        />
                      </View>

                      <View style={styles.itemTextContainer}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemTime}>{item.time}</Text>
                        </View>
                        <Text style={styles.itemMessage}>{item.message}</Text>
                      </View>

                      {item.unread && <View style={styles.unreadDot} />}
                    </View>
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C1121F",
    marginTop: 6,
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
