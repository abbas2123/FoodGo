import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreenProps } from '../../../navigation/types';
import { Button } from '../../../components/common/Button';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { verifyOtpThunk } from '../../../store/slices/authSlice';
import { spacing, typography, radius } from '../../../theme';
import { authApi } from '../../../api/auth/authApi';
import { useTheme } from '../../../theme/useTheme';

const OTP_LENGTH = 6;

export const OtpVerificationScreen: React.FC<AuthScreenProps<'OtpVerification'>> = ({
  route,
  navigation,
}) => {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const phoneNumber = route.params?.phoneNumber || '';

  const submitOtp = async (codeToVerify: string) => {
    if (codeToVerify.length !== OTP_LENGTH || loading) return;

    Keyboard.dismiss();
    setLoading(true);
    setErrorMessage(null);

    try {
      const resultAction = await dispatch(
        verifyOtpThunk({ phone: phoneNumber, otp: codeToVerify }),
      );

      if (verifyOtpThunk.rejected.match(resultAction)) {
        const errorMsg = (resultAction.payload as string) || 'Verification failed';
        setErrorMessage(errorMsg);
        Alert.alert('Verification Failed', errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Something went wrong';
      setErrorMessage(errorMsg);
      Alert.alert('Verification Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    setOtp(numericText);
    if (errorMessage) setErrorMessage(null);
    if (numericText.length === OTP_LENGTH) submitOtp(numericText);
  };

  const handleResendOtp = async () => {
    if (!phoneNumber || resending) return;
    setResending(true);
    setErrorMessage(null);
    setOtp('');
    try {
      await authApi.sendOtp(phoneNumber);
      Alert.alert('Success', 'A new 6-digit verification code has been sent.');
      inputRef.current?.focus();
    } catch (err: any) {
      const msg = err?.message || 'Failed to resend verification code.';
      setErrorMessage(msg);
      Alert.alert('Resend Failed', msg);
    } finally {
      setResending(false);
    }
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backText, { color: theme.primary }]}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Enter 6-Digit Code</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Enter the 6-digit code sent to {phoneNumber || 'your phone number'}
          </Text>

          <Pressable style={styles.otpBoxesContainer} onPress={focusInput}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const digit = otp[index] || '';
              const isFocused = otp.length === index;
              const isFilled = digit.length > 0;

              return (
                <View
                  key={index}
                  style={[
                    styles.digitBox,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: errorMessage
                        ? '#EF4444'
                        : isFocused || isFilled
                          ? theme.primary
                          : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.digitText, { color: theme.text }]}>{digit}</Text>
                  {isFocused && (
                    <View style={[styles.cursor, { backgroundColor: theme.primary }]} />
                  )}
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            value={otp}
            onChangeText={handleOtpChange}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            editable={!loading}
          />

          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          <TouchableOpacity
            style={styles.resendContainer}
            onPress={handleResendOtp}
            disabled={resending || loading}
          >
            <Text style={[styles.resendText, { color: theme.primary }]}>
              {resending ? 'Sending new code...' : "Didn't receive the code? Resend"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Button
            title="Verify & Continue"
            onPress={() => submitOtp(otp)}
            disabled={otp.length !== OTP_LENGTH || loading}
            loading={loading}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    height: 44,
    justifyContent: 'center',
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  otpBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: spacing.md,
  },
  digitBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  cursor: {
    position: 'absolute',
    bottom: 10,
    width: 16,
    height: 2,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  errorText: {
    ...typography.caption,
    color: '#EF4444',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  resendContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    padding: spacing.xs,
  },
  resendText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    width: '100%',
    paddingBottom: spacing.md,
  },
});

export default OtpVerificationScreen;
