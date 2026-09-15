import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  locality: string | null;
  city: string;
  district: string | null;
  state: string;
  country: string | null;
  postalCode: string | null;
  formattedAddress: string | null;
  displayLocation: string | null;
  address: string;
  label: string;
  loading: boolean;
  permissionGranted: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: LocationState = {
  latitude: null,
  longitude: null,
  locality: null,
  city: '',
  district: null,
  state: '',
  country: null,
  postalCode: null,
  formattedAddress: null,
  displayLocation: null,
  address: '',
  label: 'Deliver to',
  loading: false,
  permissionGranted: false,
  error: null,
  lastUpdated: null,
};

export interface SetLocationPayload {
  latitude: number;
  longitude: number;
  locality?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  formattedAddress?: string | null;
  displayLocation?: string | null;
  address?: string;
}

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocationLoading: (state) => {
      state.loading = true;
      state.error = null;
    },

    setLocation: (state, action: PayloadAction<SetLocationPayload>) => {
      const payload = action.payload;
      state.loading = false;
      state.permissionGranted = true;
      state.error = null;
      state.latitude = payload.latitude;
      state.longitude = payload.longitude;
      state.locality = payload.locality ?? null;
      state.city = payload.city ?? '';
      state.district = payload.district ?? null;
      state.state = payload.state ?? '';
      state.country = payload.country ?? null;
      state.postalCode = payload.postalCode ?? null;
      state.formattedAddress = payload.formattedAddress ?? null;
      state.displayLocation = payload.displayLocation ?? null;
      state.lastUpdated = new Date().toISOString();

      if (payload.address) {
        state.address = payload.address;
      } else if (payload.displayLocation) {
        state.address = payload.displayLocation;
      } else if (payload.locality && payload.state) {
        state.address = `${payload.locality}, ${payload.state}`;
      } else if (payload.city && payload.state) {
        state.address = `${payload.city}, ${payload.state}`;
      } else if (payload.district && payload.state) {
        state.address = `${payload.district}, ${payload.state}`;
      } else if (payload.city) {
        state.address = payload.city;
      } else if (payload.state) {
        state.address = payload.state;
      } else {
        state.address = 'Current location';
      }
    },

    setPermissionDenied: (state) => {
      state.loading = false;
      state.permissionGranted = false;
      state.error = 'Location permission denied';
      state.lastUpdated = new Date().toISOString();
    },

    setLocationError: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
      state.lastUpdated = new Date().toISOString();
    },

    setDeliveryAddress: (
      state,
      action: PayloadAction<{
        address: string;
        label?: string;
        coordinates?: { latitude: number; longitude: number };
      }>,
    ) => {
      state.address = action.payload.address;
      state.displayLocation = action.payload.address;
      if (action.payload.label !== undefined) {
        state.label = action.payload.label;
      }
      if (action.payload.coordinates !== undefined) {
        state.latitude = action.payload.coordinates.latitude;
        state.longitude = action.payload.coordinates.longitude;
      }
    },

    resetLocation: () => initialState,
  },
});

export const {
  setLocationLoading,
  setLocation,
  setPermissionDenied,
  setLocationError,
  setDeliveryAddress,
  resetLocation,
} = locationSlice.actions;

export default locationSlice.reducer;
