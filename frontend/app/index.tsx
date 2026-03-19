import { Text, TextInput, View, StyleSheet, Pressable, Animated } from "react-native";
import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";

import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";


import { supabase } from '@/lib/supabase'; 


const API_URL = "http://localhost:8080";

export default function LoginScreen() {

    /**
     * to do:
     * take first and last name in signup
     * display error messages cleanly
     */

    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    const { login } = useAuth();
    const router = useRouter();


    const [loginHovered, setLoginHovered] = useState(false);
    const [signupHovered, setSignupHovered] = useState(false);

    const loginScaleAnim = useRef(new Animated.Value(1)).current;
    const signupScaleAnim = useRef(new Animated.Value(1)).current;

    const [fontsLoaded] = useFonts({
        BebasNeue_400Regular,
    });

    if (!fontsLoaded) {
        return null;
    }

    const handlePressIn = (anim: Animated.Value) => {
        Animated.spring(loginScaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
    };
    const handlePressOut = (anim: Animated.Value) => {
        Animated.spring(loginScaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };


    const handleLogin = async () => {

        setError("");
        //check if required fields are filled
        if ( !setEmail || !setPassword ) {
            return console.log("Please enter both email and password");
        }

        setLoading(true);
        //take input and format into request
        try {
            await login(email.trim(), password);
        } catch (error) {
            const apiErr = error as ApiError;
            setError(apiErr.message || "Login failed. Please try again.");
        } finally{
            setLoading(false);
        }



            //navigate user to main dashboard and pass token


        //send request and if response fails, put message

        //if response succeeds, take user token and navigate to dashboard 
        //populate dashboard with token and use token to populate data
    }
    const handleSignup = async () => {
        router.push("/signupscreen")
    };
 
    
    return (
    <View style={s.container}>
      <Text style={s.title}>ChangeNow</Text>
      <Text style={s.subtitle}>Your fitness journey starts here</Text>

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
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <Animated.View style={{ transform: [{ scale: loginScaleAnim }] }}>
        <Pressable
          style={({ pressed }) => [
            s.primaryButton,
            (loginHovered || pressed) && s.primaryButtonPressed,
            loading && s.buttonDisabled,
          ]}
          onPress={handleLogin}
          onPressIn={() => handlePressIn(loginScaleAnim)}
          onPressOut={() => handlePressOut(loginScaleAnim)}
          onHoverIn={() => setLoginHovered(true)}
          onHoverOut={() => setLoginHovered(false)}
          disabled={loading}
        >
          <Text style={s.primaryButtonText}>
            {loading ? "Logging in..." : "Log In"}
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={{ transform: [{ scale: signupScaleAnim }] }}>
        <Pressable
          style={({ pressed }) => [
            s.secondaryButton,
            (signupHovered || pressed) && s.secondaryButtonPressed,
          ]}
          onPress={() => router.push("/signupscreen")}
          onPressIn={() => handlePressIn(signupScaleAnim)}
          onPressOut={() => handlePressOut(signupScaleAnim)}
          onHoverIn={() => setSignupHovered(true)}
          onHoverOut={() => setSignupHovered(false)}
          disabled={loading}
        >
          <Text style={s.secondaryButtonText}>Create Account</Text>
        </Pressable>
      </Animated.View>
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
    fontSize: fontSize.title,
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
    minWidth: 200,
    alignItems: "center",
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  primaryButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    fontFamily: "BebasNeue_400Regular",
    color: colors.text,
    letterSpacing: 1,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    minWidth: 200,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonPressed: {
    backgroundColor: "rgba(233, 69, 96, 0.1)",
  },
  secondaryButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    fontFamily: "BebasNeue_400Regular",
    color: colors.primary,
    letterSpacing: 1,
  },
  buttonDisabled: { opacity: 0.6 },
});