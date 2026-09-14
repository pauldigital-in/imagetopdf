import Ionicons from "@react-native-vector-icons/ionicons";
import type { ComponentProps } from "react";

type IoniconsProps = ComponentProps<typeof Ionicons>;

// Centralized icon wrapper so the icon set lives in one place.
export function Icon(props: IoniconsProps) {
  return <Ionicons {...props} />;
}

export type IconName = IoniconsProps["name"];
