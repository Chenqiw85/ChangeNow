import React, { useState, useRef,useCallback } from "react";
import { Text, TextInput, View, StyleSheet, Pressable, Animated, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { supabase } from '@/lib/supabase'; 
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";


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

  

  useFocusEffect(
  useCallback(() => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }, [])
);

  const [fontsLoaded] = useFonts({
        BebasNeue_400Regular,
    });

    if (!fontsLoaded) {
        return null;
    }


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

    try {
      await register(email.trim(), password);
      } catch (error) {
          const apiErr = error as ApiError;
          setError(apiErr.message || "Signup failed. Please try again.");
      }finally{
        setLoading(false);
      }
    }
    
   return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#666"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Animated.View style={{ transform: [{ scale: signupScaleAnim }] }}>
        <Pressable
          style={({ pressed }) => [
            styles.signupButton,
            signupHovered && styles.signupButtonHovered,
            pressed && styles.signupButtonHovered,
            loading && styles.buttonDisabled,
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
          <Text style={styles.signupButtonText}>
            {loading ? "Creating Account..." : "Create Account"}
          </Text>
        </Pressable>
      </Animated.View>

      <Pressable onPress={() => router.back()} disabled={loading}>
        <Text style={styles.backLink}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "#48494b",
  },
  title: {
    fontSize: 48,
    fontFamily: "BebasNeue_400Regular",
    fontWeight: "bold",
    margin: 40,
    color: "#ffffff",
  },
  inputContainer: {
    backgroundColor: "#616569",
    borderRadius: 20,
    padding: 20,
    width: "80%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#363636",
    overflow: "hidden",
    alignSelf: "center",
  },
  input: {
    backgroundColor: "#f5f5f5",
    color: "#000000",
    padding: 10,
    marginBottom: 20,
    width: "100%",
    borderRadius: 8,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 14,
    marginBottom: 12,
    width: "80%",
    textAlign: "center",
  },
  signupButton: {
    backgroundColor: "#000000",
    padding: 16,
    width: 220,
    alignItems: "center",
    borderRadius: 50,
    marginTop: 10,
  },
  signupButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "BebasNeue_400Regular",
    color: "#f5f5f5",
  },
  signupButtonHovered: { backgroundColor: "#222222" },
  buttonDisabled: { opacity: 0.6 },
  backLink: {
    color: "#aaa",
    marginTop: 20,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
