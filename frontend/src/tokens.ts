// Spacing / radius / typography scales from design_guidelines.json.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  display: 30,
} as const;

// Max font weight is 500 per design guidelines. Build hierarchy with size + color.
export const weight = {
  regular: "400" as const,
  medium: "500" as const,
};
