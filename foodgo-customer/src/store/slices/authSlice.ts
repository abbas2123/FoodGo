import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { authApi, TokensDto } from '../../api/auth/authApi';
import { usersApi, UpdateProfileDto } from '../../api/users/usersApi';
import { SecureStorage } from '../../services/storage/secureStorage';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  type: string;
  status: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
};

export const sendOtpThunk = createAsyncThunk(
  'auth/sendOtp',
  async (phone: string, { rejectWithValue }) => {
    try {
      const response = await authApi.sendOtp(phone);
      return response.message;
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Failed to send OTP');
    }
  },
);

export const verifyOtpThunk = createAsyncThunk(
  'auth/verifyOtp',
  async ({ phone, otp }: { phone: string; otp: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOtp(phone, otp);
      const data = response.data;

      await SecureStorage.setTokens(
        data.tokens.accessToken,
        data.tokens.refreshToken,
      );

      return data;
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Failed to verify OTP');
    }
  },
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const refreshToken = state.auth.refreshToken || (await SecureStorage.getRefreshToken());
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => {});
      }
      await SecureStorage.clearTokens();
    } catch (error: any) {
      await SecureStorage.clearTokens();
      return rejectWithValue(error?.message || 'Logout failed');
    }
  },
);

export const restoreSessionThunk = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = await SecureStorage.getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const response = await authApi.refreshToken(refreshToken);
      const data = response.data;

      await SecureStorage.setTokens(
        data.tokens.accessToken,
        data.tokens.refreshToken,
      );

      return data;
    } catch (error: any) {
      await SecureStorage.clearTokens();
      return rejectWithValue(error?.message || 'Session expired');
    }
  },
);

export const updateProfileThunk = createAsyncThunk(
  'auth/updateProfile',
  async (dto: UpdateProfileDto, { rejectWithValue }) => {
    try {
      const response = await usersApi.updateProfile(dto);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to update profile',
      );
    }
  },
);

export const fetchProfileThunk = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await usersApi.getProfile();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch profile',
      );
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ name?: string | null; phone: string; id?: string; type?: string; status?: string }>) => {
      state.isAuthenticated = true;
      state.user = {
        id: action.payload.id || '1',
        phone: action.payload.phone,
        name: action.payload.name || null,
        type: action.payload.type || 'CUSTOMER',
        status: action.payload.status || 'ACTIVE',
      };
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = {
          ...state.user,
          ...action.payload,
        };
      }
    },
    setTokens: (state, action: PayloadAction<TokensDto>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    clearError: (state) => {
      state.error = null;
    },
    logOut: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendOtpThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOtpThunk.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(sendOtpThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(verifyOtpThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtpThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.tokens.accessToken;
        state.refreshToken = action.payload.tokens.refreshToken;
        state.error = null;
      })
      .addCase(verifyOtpThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(logoutThunk.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.loading = false;
        state.error = null;
      });

    builder
      .addCase(restoreSessionThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.accessToken = action.payload.tokens.accessToken;
          state.refreshToken = action.payload.tokens.refreshToken;
        }
      })
      .addCase(restoreSessionThunk.rejected, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
      });

    builder
      .addCase(updateProfileThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = {
            ...state.user,
            name: action.payload.name,
            ...(action.payload.phone ? { phone: action.payload.phone } : {}),
          };
        }
        state.error = null;
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(fetchProfileThunk.fulfilled, (state, action) => {
        if (state.user) {
          state.user = {
            ...state.user,
            name: action.payload.name,
            ...(action.payload.phone ? { phone: action.payload.phone } : {}),
          };
        }
      });
  },
});

export const { login, updateUser, logOut, setTokens, clearError } = authSlice.actions;
export default authSlice.reducer;
