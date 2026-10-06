import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  phone_number?: string;
  role: 'rider' | 'student' | 'driver' | 'admin' | string;
  vehicle_plate_number?: string | null;
  matric_number?: string | null;
  [key: string]: any;
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName?: string;
  phoneNumber?: string;
  role?: 'rider' | 'student' | 'driver' | 'admin' | string;
  vehiclePlateNumber?: string | null;
  matricNumber?: string | null;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<any>;
  signIn: (params: SignInParams) => Promise<any>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const normalizedRole = data.role === 'student' ? 'rider' : data.role;
        const mappedProfile = { ...data, role: normalizedRole } as UserProfile;
        setProfile(mappedProfile);
        return mappedProfile;
      }
    } catch (err) {
      console.error('Error fetching profile from database:', err);
    }
    return null;
  }

  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error getting initial session:', err);
      } finally {
        setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async ({
    email,
    password,
    fullName,
    phoneNumber,
    role = 'rider',
    vehiclePlateNumber,
    matricNumber,
  }: SignUpParams) => {
    const assignedRole = role === 'student' ? 'rider' : role;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone_number: phoneNumber,
          role: assignedRole,
          vehicle_plate_number: vehiclePlateNumber || null,
          matric_number: matricNumber || null,
        },
      },
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user.id);
    }
    return data;
  };

  const signIn = async ({ email, password }: SignInParams) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user.id);
    }
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    if (error) throw error;
  };

  // Provide fallback profile from user_metadata if database row hasn't synced yet
  const effectiveProfile: UserProfile | null = profile || (user ? {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || '',
    phone_number: user.user_metadata?.phone_number || '',
    role: (user.user_metadata?.role === 'student' ? 'rider' : user.user_metadata?.role) || 'rider',
    vehicle_plate_number: user.user_metadata?.vehicle_plate_number || null,
    matric_number: user.user_metadata?.matric_number || null,
  } : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: effectiveProfile,
        loading,
        signUp,
        signIn,
        signOut,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;