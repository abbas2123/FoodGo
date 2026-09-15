import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ComingSoon() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="time-outline" size={55} color="#DD3339" />
        </View>

        <Text style={styles.title}>Coming Soon</Text>

        <Text style={styles.description}>
          We're working on something amazing.
          {"\n"}
          Stay tuned!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF9F7",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#FFE5E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#222222",
    marginBottom: 12,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#777777",
  },
});
