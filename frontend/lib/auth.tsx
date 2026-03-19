import React, { createContext, useContext, useEffect, useState } from "react";
import {
  apiLogin,
  apiRegister,
  getToken,
  removeToken,
  ApiError,
} from "@/lib/api";

interface AuthUser {
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;   // null = no login
  isLoading: boolean;       // true = checking local token
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
// ------- Provider --------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // App启动时，检查SecureStore里是否已有token
  // 有的话 → 直接设为已登录（免得每次开app都要重新登录）
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          setUser({ token });
        }
      } catch (e) {
        console.log("Failed to load stored token:", e);
      } finally {
        setIsLoading(false); // 不管有没有token，loading结束
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    // apiLogin 内部会自动存token到SecureStore
    const res = await apiLogin(email, password);
    setUser({ token: res.access_token });
  };

  const register = async (email: string, password: string) => {
    // 先注册，再自动登录
    await apiRegister(email, password);
    await login(email, password);
  };

  const logout = async () => {
    await removeToken(); // 清除存储的token
    setUser(null);       // 状态置空 → 触发UI更新
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}