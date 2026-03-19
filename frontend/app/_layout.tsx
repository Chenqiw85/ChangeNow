import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ActivityIndicator, View } from "react-native";

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // 还在读token，先不跳

    // segments[0] === "screens" 说明用户在受保护的页面里
    const inProtectedArea = segments[0] === "screens";

    if (!user && inProtectedArea) {
      // 没登录却在受保护区域 → 踢到登录页
      router.replace("/");
    } else if (user && !inProtectedArea) {
      // 已登录但在登录/注册页 → 跳到 dashboard
      router.replace("/screens/Tabscreens/maindashboard");
    }
  }, [user, isLoading, segments]);

  // token 还在加载中 → 显示全屏 loading
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signupscreen" />
      <Stack.Screen name="screens" />
    </Stack>
  );
}


export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}