/**
 * Custom Map Styles for Google Maps / MapView.
 * Provides clean, minimal delivery-app styling for Light and Dark modes.
 */

export const lightMapStyle = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e5f3e5" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#fefefe" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ffe2cc" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a7a7a" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d2e9fa" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f7f7f9" }],
  },
];

export const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#1d2026" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2026" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8f98" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#182b24" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#282c34" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#20232a" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3e372e" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#111827" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#16181d" }],
  },
];
