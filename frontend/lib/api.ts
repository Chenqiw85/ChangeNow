import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Path } from "react-native-svg";

// ─── Base URL config ──────────────────────────────────
const API_BASE =
  Platform.OS === "android"
    ? "http://10.0.2.2:8080/v1"
    : "http://localhost:8080/v1";


const TOKEN_KEY = "auth_token";

//Token

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof window !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}


export interface ApiError {
  status: number;
  message: string;
}

/**
 * @param path
 * @param opts
 */

export async function apiFetch<T = any>(
    path: string,
    opts:{
        method? : "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
        body?: unknown;
        auth?: boolean;
    } = {}
): Promise<T> {
    const {method = "GET",body, auth = true } = opts;
    const headers: Record<string,string> = {
        "Content-Type" : "application/json",
    };
    if (auth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || `Request failed with status ${res.status}`;
    throw { status: res.status, message } as ApiError;
  }

  return data as T;
}


export interface LoginResponse {
  access_token: string; 
}

export interface RegisterResponse {
  id: number;
  email: string;
}

export async function apiLogin(
  email: string,
  password: string
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false, 
  });
  await setToken(data.access_token);
  return data;
}

export async function apiRegister(
  email: string,
  password: string
): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}