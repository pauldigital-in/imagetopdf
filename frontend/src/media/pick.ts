import * as ImagePicker from "expo-image-picker";

export type PickedImage = { uri: string; width: number; height: number };

// Uses Android's modern system photo picker — no broad storage permission needed.
export async function pickFromGallery(limit: number): Promise<PickedImage[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: limit > 0 ? limit : 0,
    quality: 1,
    exif: false,
  });
  if (res.canceled || !res.assets) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    width: a.width ?? 0,
    height: a.height ?? 0,
  }));
}

export async function captureFromCamera(): Promise<PickedImage | null> {
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    exif: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

export type CameraPermission = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function getCameraPermission(): Promise<CameraPermission> {
  const p = await ImagePicker.getCameraPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

export async function requestCameraPermission(): Promise<CameraPermission> {
  const p = await ImagePicker.requestCameraPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}
