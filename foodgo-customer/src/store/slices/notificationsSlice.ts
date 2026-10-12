import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  notificationsApi,
  AppNotification,
  NotificationsResponseData,
} from "@/api/notifications/notificationsApi";
import { logoutThunk } from "./authSlice";

export interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

export const fetchNotifications = createAsyncThunk<
  NotificationsResponseData,
  void,
  { rejectValue: string }
>("notifications/fetchAll", async (_, { rejectWithValue }) => {
  try {
    const res = await notificationsApi.getNotifications();
    return res.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to load notifications",
    );
  }
});

export const markNotificationAsRead = createAsyncThunk<
  AppNotification,
  number,
  { rejectValue: string }
>("notifications/markAsRead", async (id, { rejectWithValue }) => {
  try {
    const res = await notificationsApi.markAsRead(id);
    return res.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to mark notification as read",
    );
  }
});

export const markAllNotificationsAsRead = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("notifications/markAllAsRead", async (_, { rejectWithValue }) => {
  try {
    await notificationsApi.markAllAsRead();
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to mark all as read",
    );
  }
});

export const deleteNotificationServer = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>("notifications/delete", async (id, { rejectWithValue }) => {
  try {
    await notificationsApi.deleteNotification(id);
    return id;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to delete notification",
    );
  }
});

export const clearAllNotificationsServer = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("notifications/clearAll", async (_, { rejectWithValue }) => {
  try {
    await notificationsApi.clearAll();
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to clear notifications",
    );
  }
});

export const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load notifications";
      });

    // Mark as read
    builder.addCase(markNotificationAsRead.fulfilled, (state, action) => {
      const idx = state.items.findIndex((n) => n.id === action.payload.id);
      if (idx > -1 && !state.items[idx].isRead) {
        state.items[idx].isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    });

    // Mark all as read
    builder.addCase(markAllNotificationsAsRead.fulfilled, (state) => {
      state.items.forEach((n) => {
        n.isRead = true;
      });
      state.unreadCount = 0;
    });

    // Delete
    builder.addCase(deleteNotificationServer.fulfilled, (state, action) => {
      const deleted = state.items.find((n) => n.id === action.payload);
      if (deleted && !deleted.isRead) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
      state.items = state.items.filter((n) => n.id !== action.payload);
    });

    // Clear all
    builder.addCase(clearAllNotificationsServer.fulfilled, (state) => {
      state.items = [];
      state.unreadCount = 0;
    });

    // Logout cleanup
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.items = [];
      state.unreadCount = 0;
      state.loading = false;
      state.error = null;
    });
  },
});

export default notificationsSlice.reducer;
