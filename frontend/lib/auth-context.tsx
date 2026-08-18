"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshAccessToken,
  resendCode as resendCodeRequest,
  signup as signupRequest,
  verifyEmail as verifyEmailRequest,
} from "@/lib/auth";

type AuthContextValue = {
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const logout = useCallback(async () => {
    await logoutRequest();
    setAccessTokenState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isLoading,
        login,
        register,
        verifyEmail,
        resendCode,
        logout,
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
