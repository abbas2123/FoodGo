import type {
  NavigatorScreenParams,
  CompositeScreenProps,
} from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneNumber: undefined;
  OtpVerification: { phoneNumber?: string } | undefined;
};

export type AppStackParamList = {
  Home: undefined;
  MainTabs: undefined;
  RestaurantDetails: { id: string } | undefined;
  Orders: undefined;
  Search: undefined;
  Fav: undefined;
  Profile: undefined;
  Checkout: undefined;
  OrderDetails: { orderId: string } | undefined;
  EditProfile: undefined;
  TrackOrderDetails: { orderId?: string } | undefined;
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
