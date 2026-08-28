import { Platform } from "react-native";

export const colors = {
  bg: "#0D1117",
  bgSoft: "#111821",
  surface: "#151D27",
  surfaceElevated: "#1B2531",
  border: "#2A3542",
  borderSoft: "#22303D",
  text: "#F4F7FB",
  textMuted: "#9AA8B6",
  textSubtle: "#6F7E8C",
  primary: "#58D68D",
  primaryDeep: "#1E7F53",
  primarySoft: "#153525",
  accent: "#6EA8FE",
  accentSoft: "#172A46",
  warning: "#F2C94C",
  warningSoft: "#352A12",
  danger: "#FF6B6B",
  dangerSoft: "#351C21",
  violet: "#B18CFF",
  violetSoft: "#261E39",
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 18,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  android: {
    elevation: 4,
  },
  default: {},
});
