import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('interviewiq_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('interviewiq_token');
      if (!token) {
        localStorage.removeItem('interviewiq_user');
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem('interviewiq_user', JSON.stringify(data.user));
        }
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('interviewiq_token');
          localStorage.removeItem('interviewiq_user');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    verifySession();
  }, []);

  const login = async (email, password, loginType = 'candidate') => {
    const { data } = await api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
      loginType,
    });
    localStorage.setItem('interviewiq_token', data.token);
    localStorage.setItem('interviewiq_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', {
      ...payload,
      email: payload.email?.trim().toLowerCase(),
    });
    localStorage.setItem('interviewiq_token', data.token);
    localStorage.setItem('interviewiq_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const googleLogin = async (googlePayload) => {
    const { data } = await api.post('/auth/google', googlePayload);
    localStorage.setItem('interviewiq_token', data.token);
    localStorage.setItem('interviewiq_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const sendForgotOtp = async (email) => {
    const { data } = await api.post('/auth/forgot-password/send-otp', {
      email: email.trim().toLowerCase(),
    });
    return data;
  };

  const verifyForgotOtp = async (email, otp) => {
    const { data } = await api.post('/auth/forgot-password/verify-otp', {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });
    return data;
  };

  const resetPasswordAfterOtp = async ({ email, otp, newPassword, confirmPassword }) => {
    const { data } = await api.post('/auth/forgot-password/reset', {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
      newPassword,
      confirmPassword,
    });
    if (data.token && data.user) {
      localStorage.setItem('interviewiq_token', data.token);
      localStorage.setItem('interviewiq_user', JSON.stringify(data.user));
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('interviewiq_token');
    localStorage.removeItem('interviewiq_user');
    setUser(null);
  };

  const updateUserState = (updated) => {
    setUser(updated);
    localStorage.setItem('interviewiq_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        googleLogin,
        sendForgotOtp,
        verifyForgotOtp,
        resetPasswordAfterOtp,
        logout,
        updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
