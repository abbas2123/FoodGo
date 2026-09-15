/**
 * Order domain types for FoodGo.
 *
 * The backend orders module is pending; these types are designed to be
 * compatible with the future API response shape.
 */

/** Geographic coordinates */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Delivery partner profile */
export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  rating: number;
  totalDeliveries: number;
  avatarUrl?: string;
}

/** Live delivery tracking snapshot */
export interface DeliveryTracking {
  restaurantLocation: Coordinates;
  deliveryPartnerLocation?: Coordinates;
  customerLocation: Coordinates;
  deliveryPartnerHeading?: number;
  estimatedArrival?: string;
  distanceRemainingMeters?: number;
  routeCoordinates?: Coordinates[];
  traveledCoordinates?: Coordinates[];
  deliveryPartner?: DeliveryPartner;
}

/** Granular order status values */
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

/** Derived display categories used in the UI tabs */
export type OrderTab = "All" | "Ongoing" | "Completed" | "Cancelled";

/** A single item in an order */
export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // price per unit in paise / cents
  customisation?: string; // e.g. "Extra Cheese, No Onion"
}

/** Restaurant snapshot attached to an order */
export interface OrderRestaurant {
  id: string;
  name: string;
  cuisine: string;
  imageUrl?: string;
  rating?: number;
  distanceKm?: number;
  location?: Coordinates;
}

/** Delivery address snapshot */
export interface OrderDeliveryAddress {
  label: string; // e.g. "Home"
  line1: string;
  location?: Coordinates;
}

/** Bill breakdown */
export interface OrderBill {
  subtotal: number;
  deliveryFee: number;
  taxes: number;
  discount: number; // positive value; UI shows it as negative
  grandTotal: number;
  currencySymbol: string; // e.g. "₹" or "$"
}

/** Payment method snapshot */
export interface OrderPayment {
  method: string; // e.g. "UPI (Google Pay)"
  isPaid: boolean;
}

/** Full order object */
export interface Order {
  id: string;
  orderNumber: string; // e.g. "FG10284"
  status: OrderStatus;
  /** Friendly one-liner status for display, e.g. "On the way" */
  statusLabel: string;
  /** ETA string shown during active delivery, e.g. "10–15 min" */
  eta?: string;
  /** ISO date-time string for delivered / cancelled time */
  completedAt?: string;
  restaurant: OrderRestaurant;
  items: OrderItem[];
  bill: OrderBill;
  deliveryAddress: OrderDeliveryAddress;
  payment: OrderPayment;
  /** 1–5 rating given by user after delivery (null if not rated yet) */
  userRating?: number | null;
  userComment?: string;
  /** Live tracking data when active */
  tracking?: DeliveryTracking;
}

/** Maps an OrderStatus to its UI tab */
export function getOrderTab(status: OrderStatus): OrderTab {
  switch (status) {
    case "PENDING":
    case "CONFIRMED":
    case "PREPARING":
    case "OUT_FOR_DELIVERY":
      return "Ongoing";
    case "DELIVERED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "All";
  }
}

/** Returns true for orders that are still active / in-progress */
export function isActiveOrder(status: OrderStatus): boolean {
  return ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"].includes(
    status
  );
}

/** Returns true for completed / delivered orders */
export function isCompletedOrder(status: OrderStatus): boolean {
  return status === "DELIVERED";
}
