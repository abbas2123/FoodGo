import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  useWindowDimensions,
} from "react-native";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setSelectedCategory } from "@/store/slices/uiSlice";

interface SpecialOfferBannerProps {
  onOrderNowPress?: () => void;
}

export const SpecialOfferBanner: React.FC<SpecialOfferBannerProps> = ({
  onOrderNowPress,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;
  const horizontalPadding = isSmallScreen ? 20 : 60;
  const dispatch = useAppDispatch();

  const handleOrder = () => {
    if (onOrderNowPress) {
      onOrderNowPress();
    } else {
      dispatch(setSelectedCategory("Burgers"));
    }
  };

  return (
    <View
      style={[
        styles.offerContainer,
        {
          marginHorizontal: horizontalPadding,
          marginTop: isSmallScreen ? 40 : 65,
          height: isSmallScreen ? 220 : 450,
          borderRadius: isSmallScreen ? 24 : 40,
        },
      ]}
    >
      <ImageBackground
        source={{
          uri: "https://thumbs.dreamstime.com/b/tasty-burger-french-fries-fire-close-up-home-made-flames-137249900.jpg",
        }}
        style={styles.offerImage}
        imageStyle={[
          styles.offerImageStyle,
          {
            borderRadius: isSmallScreen ? 24 : 40,
          },
        ]}
      >
        <View
          style={[
            styles.offerOverlay,
            {
              paddingHorizontal: isSmallScreen ? 22 : 55,
            },
          ]}
        >
          <View>
            <View
              style={[
                styles.offerLabelContainer,
                {
                  paddingHorizontal: isSmallScreen ? 12 : 25,
                  paddingVertical: isSmallScreen ? 6 : 10,
                  borderRadius: isSmallScreen ? 10 : 15,
                  marginBottom: isSmallScreen ? 10 : 25,
                },
              ]}
            >
              <Text
                style={[
                  styles.offerLabel,
                  {
                    fontSize: isSmallScreen ? 14 : 28,
                  },
                ]}
              >
                Special Offer
              </Text>
            </View>

            <Text
              style={[
                styles.offerTitle,
                {
                  fontSize: isSmallScreen ? 30 : 52,
                },
              ]}
            >
              50% OFF
            </Text>

            <Text
              style={[
                styles.offerSubtitle,
                {
                  fontSize: isSmallScreen ? 17 : 32,
                },
              ]}
            >
              your first order
            </Text>

            <Pressable
              style={[
                styles.orderButton,
                {
                  width: isSmallScreen ? 150 : 290,
                  height: isSmallScreen ? 45 : 75,
                  borderRadius: isSmallScreen ? 13 : 22,
                  marginTop: isSmallScreen ? 15 : 35,
                },
              ]}
              onPress={handleOrder}
            >
              <Text
                style={[
                  styles.orderButtonText,
                  {
                    fontSize: isSmallScreen ? 17 : 28,
                  },
                ]}
              >
                Order now
              </Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  offerContainer: {
    overflow: "hidden",
  },
  offerImage: {
    flex: 1,
    justifyContent: "center",
  },
  offerImageStyle: {
    resizeMode: "cover",
  },
  offerOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  offerLabelContainer: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(130, 50, 50, 0.75)",
  },
  offerLabel: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  offerTitle: {
    fontWeight: "800",
    color: "#FFFFFF",
  },
  offerSubtitle: {
    color: "#FFFFFF",
    marginTop: 4,
  },
  orderButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C1121F",
  },
  orderButtonText: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
