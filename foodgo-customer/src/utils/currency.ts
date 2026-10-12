/**
 * Indian Rupee (INR) currency formatter.
 * Always formats with ₹ symbol and 0 decimal places for whole numbers.
 * e.g. formatINR(299) => "₹299"
 *      formatINR(299.5) => "₹299.50"
 */
export function formatINR(amount: number): string {
  if (Number.isInteger(amount)) {
    return `₹${amount.toLocaleString("en-IN")}`;
  }
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a price that may come from the backend.
 * Uses currencySymbol from order.bill if present, otherwise ₹.
 */
export function formatOrderAmount(amount: number, currencySymbol = "₹"): string {
  if (Number.isInteger(amount)) {
    return `${currencySymbol}${amount.toLocaleString("en-IN")}`;
  }
  return `${currencySymbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Free delivery threshold in INR */
export const FREE_DELIVERY_THRESHOLD_INR = 300;

/** Delivery fee in INR */
export const DELIVERY_FEE_INR = 40;

/** Platform & GST fee in INR */
export const PLATFORM_FEE_INR = 20;
