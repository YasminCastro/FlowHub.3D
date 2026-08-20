"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  decodeAccessToken,
  forgotPassword as forgotPasswordRequest,
  login as loginRequest,
  logout as logoutRequest,
  refreshAccessToken,
  resendCode as resendCodeRequest,
  resetPassword as resetPasswordRequest,
  signup as signupRequest,
  verifyEmail as verifyEmailRequest,
} from "@/lib/api/auth";

type AuthContextValue = {
  accessToken: string | null;
  user: { id: string; email: string; name: string | null } | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const user = useMemo(() => {
    if (!accessToken) return null;
    const payload = decodeAccessToken(accessToken);
    return payload
      ? { id: payload.sub, email: payload.email, name: payload.name }
      : null;
  }, [accessToken]);

  useEffect(() => {
    refreshAccessToken()
      .then(setAccessTokenState)
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password);
    setAccessTokenState(data.accessToken);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      await signupRequest(email, password, name);
    },
    [],
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const data = await verifyEmailRequest(email, code);
    setAccessTokenState(data.accessToken);
  }, []);

  const resendCode = useCallback(async (email: string) => {
    await resendCodeRequest(email);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await forgotPasswordRequest(email);
  }, []);

  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      await resetPasswordRequest(email, code, newPassword);
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setAccessTokenState(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const newToken = await refreshAccessToken();
    setAccessTokenState(newToken);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        isLoading,
        login,
        register,
        verifyEmail,
        resendCode,
        forgotPassword,
        resetPassword,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
