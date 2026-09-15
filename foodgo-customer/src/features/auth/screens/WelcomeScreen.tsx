import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreenProps } from '../../../navigation/types';
import { Button } from '../../../components/common/Button';
import { spacing, typography } from '../../../theme';
import { useTheme } from '../../../theme/useTheme';

export const WelcomeScreen: React.FC<AuthScreenProps<'Welcome'>> = ({ navigation }) => {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.logoText}>FoodGo</Text>
          </View>
          <Text style={[styles.headline, { color: theme.text }]}>
            Delicious food delivered to your door
          </Text>
          <Text style={[styles.subhead, { color: theme.muted }]}>
            Discover top-rated local restaurants and get your favorite dishes delivered in minutes.
          </Text>
        </View>

        <View style={styles.actionContainer}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate('PhoneNumber')}
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
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
    marginBottom: spacing.xl,
  },
  logoText: {
    ...typography.h1,
    color: '#FFFFFF',
    fontSize: 36,
  },
  headline: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subhead: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  actionContainer: {
    width: '100%',
  },
});

export default WelcomeScreen;
