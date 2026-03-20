import React, { useState, useRef, useCallback } from "react";
import { Text, TextInput, View, StyleSheet, Pressable, Animated, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";

const API_URL = "http://localhost:8080";

export default function SignupScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [signupHovered, setSignupHovered] = useState(false);

  const signupScaleAnim = useRef(new Animated.Value(1)).current;


  const [fontsLoaded] = useFonts({ BebasNeue_400Regular, });

  if (!fontsLoaded) { return null; }


  const handleSignup = async () => {
    setError("");


    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }
    // Confirm password check
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
    } catch (error) {
      const apiErr = error as ApiError;
      setError(apiErr.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      
      <Text style={s.title}>Join ChangeNow</Text>
      <Text style={s.subtitle}>Create your account to get started</Text>

      <View style={s.inputContainer}>
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        <TextInput
          style={[s.input, { marginBottom: 0 }]}
          placeholder="Confirm Password"
          placeholderTextColor={colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
        />
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <Animated.View style={{ transform: [{ scale: signupScaleAnim }] }}>
        <Pressable
          style={({ pressed }) => [
            s.primaryButton,
            (signupHovered || pressed) && s.primaryButtonPressed,
            loading && s.buttonDisabled,
          ]}
          onPress={handleSignup}
          onPressIn={() => {
            Animated.spring(signupScaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
          }}
          onPressOut={() => {
            Animated.spring(signupScaleAnim, { toValue: 1, useNativeDriver: true }).start();
          }}
          onHoverIn={() => setSignupHovered(true)}
          onHoverOut={() => setSignupHovered(false)}
          disabled={loading}
        >
          <Text style={s.primaryButtonText}>
            {loading ? "Creating Account..." : "Create Account"}
          </Text>
        </Pressable>
      </Animated.View>

      <Pressable onPress={() => router.back()} disabled={loading}>
        <Text style={s.backLink}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: "BebasNeue_400Regular",
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.bgInput,
    color: colors.text,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: "100%",
    borderRadius: borderRadius.sm,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    minWidth: 220,
    alignItems: "center",
  },
  primaryButtonPressed: { backgroundColor: colors.primaryDark },
  primaryButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    fontFamily: "BebasNeue_400Regular",
    color: colors.text,
    letterSpacing: 1,
  },
  buttonDisabled: { opacity: 0.6 },
  backLink: {
    color: colors.textSecondary,
    marginTop: spacing.lg,
    fontSize: fontSize.sm,
    textDecorationLine: "underline",
  },
});