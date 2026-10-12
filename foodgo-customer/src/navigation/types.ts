import type {
  NavigatorScreenParams,
  CompositeScreenProps,
} from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneNumber: undefined;
  OtpVerification: { email?: string } | undefined;
};

export interface ProductDetailsParams {
  dish: {
    id: string | number;
    name: string;
    price: number | string;
    image?: string;
    description?: string;
    rating?: number | string;
    isVeg?: boolean;
    reviews?: string | number;
    category?: string;
    isBestseller?: boolean;
  };
  restaurantId?: string;
  restaurantName?: string;
}

export type AppStackParamList = {
  Home: undefined;
  MainTabs: undefined;
  RestaurantDetails: { id: string } | undefined;
  ProductDetails: ProductDetailsParams;
  Orders: undefined;
  Search: undefined;
  Fav: undefined;
  Profile: undefined;
  Checkout: undefined;
  OrderDetails: { orderId: string } | undefined;
  EditProfile: undefined;
  TrackOrderDetails: { orderId?: string } | undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

export type AppScreenProps<T extends keyof AppStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AppStackParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;
