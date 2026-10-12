import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface RazorpayCheckoutSuccessResult {
  providerPaymentId: string;
  providerOrderId: string;
  providerSignature: string;
}

export interface RazorpayPaymentError {
  code?: string;
  description?: string;
  source?: string;
  step?: string;
  reason?: string;
}

export interface RazorpayCheckoutModalProps {
  visible: boolean;
  isVerifying?: boolean;
  keyId: string;
  orderId: number | string;
  orderNumber: string;
  providerOrderId: string;
  amount: number; // in INR
  currency?: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  onSuccess: (result: RazorpayCheckoutSuccessResult) => void;
  onDismiss: () => void;
  onError: (error: RazorpayPaymentError) => void;
}

export function RazorpayCheckoutModal({
  visible,
  isVerifying = false,
  keyId,
  orderId,
  orderNumber,
  providerOrderId,
  amount,
  currency = "INR",
  prefill,
  onSuccess,
  onDismiss,
  onError,
}: RazorpayCheckoutModalProps) {
  const insets = useSafeAreaInsets();
  const [webViewLoading, setWebViewLoading] = useState(true);
  const hasHandledResponseRef = React.useRef(false);

  React.useEffect(() => {
    if (visible && !isVerifying) {
      hasHandledResponseRef.current = false;
      setWebViewLoading(true);
    }
  }, [visible, isVerifying, providerOrderId]);

  if (!visible && !isVerifying) return null;

  const isMockKey = keyId.toLowerCase().includes("mock");

  // In offline local development when mock keys are used (no Razorpay credentials in .env),
  // provide a controlled sandbox test harness.
  if (isMockKey) {
    return (
      <Modal visible={visible || isVerifying} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.mockCard, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="flask-outline" size={22} color="#D97706" />
                <Text style={styles.headerTitle}>Razorpay Sandbox (Dev Mode)</Text>
              </View>
              <Pressable
                onPress={isVerifying ? undefined : onDismiss}
                disabled={isVerifying}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={isVerifying ? "#CBD5E1" : "#64748B"} />
              </Pressable>
            </View>

            <View style={styles.mockWarningBanner}>
              <Ionicons name="information-circle" size={18} color="#92400E" />
              <Text style={styles.mockWarningText}>
                Mock payment mode is active in development. Real Razorpay keys (rzp_test_... or rzp_live_...) are not configured in backend .env.
              </Text>
            </View>

            <View style={styles.mockDetailsBox}>
              <Text style={styles.mockDetailLabel}>Order Number</Text>
              <Text style={styles.mockDetailValue}>#{orderNumber}</Text>

              <Text style={styles.mockDetailLabel}>Provider Order ID</Text>
              <Text style={styles.mockDetailValue}>{providerOrderId}</Text>

              <Text style={styles.mockDetailLabel}>Amount to Pay</Text>
              <Text style={styles.mockDetailAmount}>₹{amount.toFixed(2)} {currency}</Text>
            </View>

            {isVerifying ? (
              <View style={styles.mockVerifyingBox}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.mockVerifyingTitle}>Verifying Payment</Text>
                <Text style={styles.mockVerifyingText}>Validating signature with server...</Text>
              </View>
            ) : (
              <View style={styles.mockActions}>
                <Pressable
                  style={styles.mockSuccessBtn}
                  onPress={() => {
                    if (hasHandledResponseRef.current) return;
                    hasHandledResponseRef.current = true;
                    const testPaymentId = `pay_mock_${Date.now()}`;
                    onSuccess({
                      providerPaymentId: testPaymentId,
                      providerOrderId,
                      providerSignature: `mock_sig_${orderId}`,
                    });
                  }}
                >
                  <Text style={styles.mockSuccessBtnText}>Simulate Successful Payment</Text>
                </Pressable>

                <Pressable
                  style={styles.mockFailBtn}
                  onPress={() => {
                    if (hasHandledResponseRef.current) return;
                    hasHandledResponseRef.current = true;
                    onError({
                      code: "PAYMENT_CANCELLED",
                      description: "Payment cancelled in sandbox testing",
                    });
                  }}
                >
                  <Text style={styles.mockFailBtnText}>Simulate Payment Failure</Text>
                </Pressable>

                <Pressable style={styles.mockCancelBtn} onPress={onDismiss}>
                  <Text style={styles.mockCancelBtnText}>Cancel &amp; Close</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // Real Razorpay Standard Web Checkout via official checkout.js
  const amountInPaise = Math.round(amount * 100);

  const checkoutHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Razorpay Checkout</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background-color: #F8FAFC;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-wrap {
          text-align: center;
          color: #475569;
        }
        .spinner {
          border: 3px solid #E2E8F0;
          border-top: 3px solid #EF4444;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div id="loader" class="loading-wrap">
        <div class="spinner"></div>
        <div style="font-size: 14px; font-weight: 600;">Opening Razorpay Checkout...</div>
      </div>

      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script>
        function postToApp(data) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
          }
        }

        window.addEventListener('load', function() {
          try {
            var options = {
              key: ${JSON.stringify(keyId)},
              amount: ${amountInPaise},
              currency: ${JSON.stringify(currency)},
              name: "FoodiGo",
              description: "Order #" + ${JSON.stringify(orderNumber)},
              order_id: ${JSON.stringify(providerOrderId)},
              prefill: {
                name: ${JSON.stringify(prefill?.name || "")},
                contact: ${JSON.stringify(prefill?.contact || "")},
                email: ${JSON.stringify(prefill?.email || "")}
              },
              theme: {
                color: "#EF4444"
              },
              modal: {
                ondismiss: function() {
                  postToApp({ type: 'DISMISSED' });
                },
                escape: false,
                backdropclose: false
              },
              handler: function(response) {
                postToApp({
                  type: 'SUCCESS',
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                });
              }
            };

            var rzp = new Razorpay(options);

            rzp.on('payment.failed', function(resp) {
              var err = resp.error || {};
              postToApp({
                type: 'FAILED',
                error: {
                  code: err.code || "PAYMENT_FAILED",
                  description: err.description || "Payment failed at gateway",
                  source: err.source || "gateway",
                  step: err.step || "unknown",
                  reason: err.reason || "unknown"
                }
              });
            });

            rzp.open();
            var l = document.getElementById('loader');
            if (l) l.style.display = 'none';
          } catch(err) {
            postToApp({
              type: 'ERROR',
              message: err.message || "Failed to launch Razorpay"
            });
          }
        });
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "SUCCESS") {
        if (hasHandledResponseRef.current) return;
        if (
          data.razorpay_payment_id &&
          data.razorpay_order_id &&
          data.razorpay_signature
        ) {
          hasHandledResponseRef.current = true;
          onSuccess({
            providerPaymentId: data.razorpay_payment_id,
            providerOrderId: data.razorpay_order_id,
            providerSignature: data.razorpay_signature,
          });
        } else {
          hasHandledResponseRef.current = true;
          onError({
            code: "INCOMPLETE_RESPONSE",
            description: "Razorpay returned an incomplete payment payload",
          });
        }
      } else if (data.type === "DISMISSED") {
        if (hasHandledResponseRef.current) return;
        hasHandledResponseRef.current = true;
        onDismiss();
      } else if (data.type === "FAILED") {
        if (hasHandledResponseRef.current) return;
        hasHandledResponseRef.current = true;
        onError({
          code: data.error?.code || "PAYMENT_FAILED",
          description: data.error?.description || "Payment failed at gateway",
          source: data.error?.source,
          step: data.error?.step,
          reason: data.error?.reason,
        });
      } else if (data.type === "ERROR") {
        if (hasHandledResponseRef.current) return;
        hasHandledResponseRef.current = true;
        onError({
          code: "INIT_ERROR",
          description: data.message || "Unable to initialize payment sheet",
        });
      }
    } catch {
      // Non-JSON message from webview
    }
  };

  return (
    <Modal visible={visible || isVerifying} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.realContainer, { paddingTop: Math.max(insets.top, 10) }]}>
        {/* Modal Toolbar */}
        <View style={styles.realHeader}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="shield-checkmark" size={18} color="#2563EB" />
            <Text style={styles.realHeaderTitle}>Razorpay Trusted Checkout</Text>
          </View>
          <Pressable
            style={[styles.closeBtn, isVerifying && { opacity: 0.3 }]}
            onPress={isVerifying ? undefined : onDismiss}
            disabled={isVerifying}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={isVerifying ? "#94A3B8" : "#1E293B"} />
          </Pressable>
        </View>

        {/* WebView & Verification View */}
        <View style={styles.webviewWrapper}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: checkoutHtml, baseUrl: "https://api.razorpay.com" }}
            onMessage={handleMessage}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            onError={(e) => {
              setWebViewLoading(false);
              if (!hasHandledResponseRef.current) {
                hasHandledResponseRef.current = true;
                onError({
                  code: "NETWORK_ERROR",
                  description: e.nativeEvent.description || "Unable to reach Razorpay gateway",
                });
              }
            }}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="compatibility"
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically
            onShouldStartLoadWithRequest={() => true}
            style={styles.webview}
          />

          {isVerifying ? (
            <View style={styles.verifyingOverlay}>
              <View style={styles.verifyingCard}>
                <ActivityIndicator size="large" color="#EF4444" />
                <Text style={styles.verifyingTitle}>Verifying Payment</Text>
                <Text style={styles.verifyingSubtitle}>
                  Securely validating cryptographic payment signature with bank gateway...
                </Text>
              </View>
            </View>
          ) : webViewLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#EF4444" />
              <Text style={styles.loadingText}>Connecting to Razorpay...</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  mockCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  mockWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  mockWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  mockDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mockDetailLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 6,
  },
  mockDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  mockDetailAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EF4444",
    marginTop: 4,
  },
  mockActions: {
    gap: 10,
    marginBottom: 12,
  },
  mockSuccessBtn: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  mockSuccessBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  mockFailBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  mockFailBtnText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "600",
  },
  mockCancelBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  mockCancelBtnText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },
  realContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  realHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  realHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  closeBtn: {
    padding: 4,
  },
  webviewWrapper: {
    flex: 1,
    position: "relative",
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 10,
  },
  verifyingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    gap: 12,
  },
  verifyingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  verifyingSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  mockVerifyingBox: {
    padding: 30,
    alignItems: "center",
    gap: 12,
  },
  mockVerifyingTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  mockVerifyingText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
});
