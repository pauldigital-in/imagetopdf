import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImageManipulator, FlipType, SaveFormat } from "expo-image-manipulator";

import { Icon, type IconName } from "@/src/components/icon";
import { useToast } from "@/src/components/toast";
import { useImageSession } from "@/src/session/image-session";
import { spacing, font, weight, radius } from "@/src/tokens";
import { haptics } from "@/src/utils/haptics";

const DARK = "#1C1C1E";
const LIGHT = "#F2F2F7";
const MUTED = "#8E8E93";
const ACCENT = "#4A7B59";
const MIN_BOX = 48;

type Rect = { x: number; y: number; w: number; h: number };

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { images, update } = useImageSession();
  const original = images.find((i) => i.id === id);

  const [uri, setUri] = useState(original?.uri ?? "");
  const [iw, setIw] = useState(original?.width ?? 0);
  const [ih, setIh] = useState(original?.height ?? 0);
  const [busy, setBusy] = useState(false);
  const [cropMode, setCropMode] = useState(false);

  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const boxRef = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const startBox = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });

  // Displayed (contain-fit) image rectangle inside the container.
  const disp = useMemo(() => {
    if (!container.w || !container.h || !iw || !ih) {
      return { x: 0, y: 0, w: 0, h: 0, scale: 1 };
    }
    const scale = Math.min(container.w / iw, container.h / ih);
    const w = iw * scale;
    const h = ih * scale;
    return { x: (container.w - w) / 2, y: (container.h - h) / 2, w, h, scale };
  }, [container, iw, ih]);

  const resetBoxToFull = useCallback(() => {
    const r = { x: disp.x, y: disp.y, w: disp.w, h: disp.h };
    boxRef.current = r;
    setBox(r);
  }, [disp]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ w: width, h: height });
  };

  const clampBox = useCallback(
    (r: Rect): Rect => {
      const minX = disp.x;
      const minY = disp.y;
      const maxRight = disp.x + disp.w;
      const maxBottom = disp.y + disp.h;
      let { x, y, w, h } = r;
      w = Math.max(MIN_BOX, w);
      h = Math.max(MIN_BOX, h);
      if (x < minX) x = minX;
      if (y < minY) y = minY;
      if (x + w > maxRight) w = maxRight - x;
      if (y + h > maxBottom) h = maxBottom - y;
      return { x, y, w, h };
    },
    [disp],
  );

  const makeCornerResponder = (corner: "tl" | "tr" | "bl" | "br") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startBox.current = { ...boxRef.current };
      },
      onPanResponderMove: (_e, g) => {
        const s = startBox.current;
        let next: Rect = { ...s };
        if (corner === "tl") {
          next = { x: s.x + g.dx, y: s.y + g.dy, w: s.w - g.dx, h: s.h - g.dy };
        } else if (corner === "tr") {
          next = { x: s.x, y: s.y + g.dy, w: s.w + g.dx, h: s.h - g.dy };
        } else if (corner === "bl") {
          next = { x: s.x + g.dx, y: s.y, w: s.w - g.dx, h: s.h + g.dy };
        } else {
          next = { x: s.x, y: s.y, w: s.w + g.dx, h: s.h + g.dy };
        }
        // Prevent negative width when dragging past opposite edge.
        if (next.w < MIN_BOX) {
          next.w = MIN_BOX;
          if (corner === "tl" || corner === "bl") next.x = s.x + s.w - MIN_BOX;
        }
        if (next.h < MIN_BOX) {
          next.h = MIN_BOX;
          if (corner === "tl" || corner === "tr") next.y = s.y + s.h - MIN_BOX;
        }
        const clamped = clampBox(next);
        boxRef.current = clamped;
        setBox(clamped);
      },
    });

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startBox.current = { ...boxRef.current };
        },
        onPanResponderMove: (_e, g) => {
          const s = startBox.current;
          const clamped = clampBox({ x: s.x + g.dx, y: s.y + g.dy, w: s.w, h: s.h });
          boxRef.current = clamped;
          setBox(clamped);
        },
      }),
    [clampBox],
  );

  const tl = useMemo(() => makeCornerResponder("tl"), [clampBox]);
  const tr = useMemo(() => makeCornerResponder("tr"), [clampBox]);
  const bl = useMemo(() => makeCornerResponder("bl"), [clampBox]);
  const br = useMemo(() => makeCornerResponder("br"), [clampBox]);

  const applyOp = useCallback(
    async (fn: (ctx: ReturnType<typeof ImageManipulator.manipulate>) => void) => {
      if (!uri) return;
      setBusy(true);
      try {
        const ctx = ImageManipulator.manipulate(uri);
        fn(ctx);
        const rendered = await ctx.renderAsync();
        const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
        setUri(out.uri);
        setIw(out.width);
        setIh(out.height);
      } catch {
        toast.show("Couldn't edit the image", "error");
      } finally {
        setBusy(false);
      }
    },
    [uri, toast],
  );

  const rotate = (deg: number) => {
    haptics.light();
    void applyOp((ctx) => ctx.rotate(deg));
  };
  const flip = (type: FlipType) => {
    haptics.light();
    void applyOp((ctx) => ctx.flip(type));
  };

  const startCrop = () => {
    resetBoxToFull();
    setCropMode(true);
  };

  const applyCrop = async () => {
    if (!disp.scale) return;
    const r = boxRef.current;
    const originX = Math.max(0, Math.round((r.x - disp.x) / disp.scale));
    const originY = Math.max(0, Math.round((r.y - disp.y) / disp.scale));
    const width = Math.min(iw - originX, Math.round(r.w / disp.scale));
    const height = Math.min(ih - originY, Math.round(r.h / disp.scale));
    if (width < 1 || height < 1) {
      setCropMode(false);
      return;
    }
    haptics.light();
    await applyOp((ctx) => ctx.crop({ originX, originY, width, height }));
    setCropMode(false);
  };

  const resetAll = () => {
    if (!original) return;
    haptics.light();
    setUri(original.uri);
    setIw(original.width);
    setIh(original.height);
    setCropMode(false);
  };

  const done = () => {
    if (original && uri) {
      update(original.id, { uri, width: iw, height: ih });
      haptics.success();
    }
    router.back();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="editor-cancel"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={styles.headerBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Image</Text>
        <Pressable
          testID="editor-done"
          hitSlop={12}
          onPress={done}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={[styles.headerBtn, { color: ACCENT, fontWeight: weight.medium }]}>
            Done
          </Text>
        </Pressable>
      </View>

      {/* Image canvas */}
      <View style={styles.canvas} onLayout={onContainerLayout}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            testID="editor-image"
          />
        ) : (
          <Text style={styles.missing}>Image not available</Text>
        )}

        {cropMode && disp.w > 0 ? (
          <>
            {/* Crop rectangle */}
            <View
              {...moveResponder.panHandlers}
              style={[
                styles.cropBox,
                { left: box.x, top: box.y, width: box.w, height: box.h },
              ]}
            >
              <View style={[styles.gridLineV, { left: "33%" }]} />
              <View style={[styles.gridLineV, { left: "66%" }]} />
              <View style={[styles.gridLineH, { top: "33%" }]} />
              <View style={[styles.gridLineH, { top: "66%" }]} />
            </View>
            <View
              {...tl.panHandlers}
              style={[styles.handle, { left: box.x - 14, top: box.y - 14 }]}
            />
            <View
              {...tr.panHandlers}
              style={[styles.handle, { left: box.x + box.w - 14, top: box.y - 14 }]}
            />
            <View
              {...bl.panHandlers}
              style={[styles.handle, { left: box.x - 14, top: box.y + box.h - 14 }]}
            />
            <View
              {...br.panHandlers}
              style={[styles.handle, { left: box.x + box.w - 14, top: box.y + box.h - 14 }]}
            />
          </>
        ) : null}

        {busy ? (
          <View style={styles.busy} testID="editor-busy">
            <ActivityIndicator color={LIGHT} size="large" />
          </View>
        ) : null}
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.md }]}>
        {cropMode ? (
          <>
            <ToolBtn icon="close-outline" label="Cancel" onPress={() => setCropMode(false)} />
            <ToolBtn icon="refresh-outline" label="Reset" onPress={resetBoxToFull} />
            <ToolBtn icon="checkmark-outline" label="Apply" accent onPress={applyCrop} testID="apply-crop" />
          </>
        ) : (
          <>
            <ToolBtn icon="arrow-undo-outline" label="Rotate" onPress={() => rotate(-90)} testID="rotate-left" />
            <ToolBtn icon="arrow-redo-outline" label="Rotate" onPress={() => rotate(90)} testID="rotate-right" />
            <ToolBtn icon="swap-horizontal-outline" label="Flip" onPress={() => flip(FlipType.Horizontal)} testID="flip-h" />
            <ToolBtn icon="swap-vertical-outline" label="Flip" onPress={() => flip(FlipType.Vertical)} testID="flip-v" />
            <ToolBtn icon="crop-outline" label="Crop" onPress={startCrop} testID="crop-start" />
            <ToolBtn icon="refresh-outline" label="Reset" onPress={resetAll} testID="reset-all" />
          </>
        )}
      </View>
    </View>
  );
}

function ToolBtn({
  icon,
  label,
  onPress,
  accent,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  accent?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, pressed && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={26} color={accent ? ACCENT : LIGHT} />
      <Text style={[styles.toolLabel, { color: accent ? ACCENT : MUTED }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DARK },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: { color: LIGHT, fontSize: font.lg, fontWeight: weight.regular },
  headerTitle: { color: LIGHT, fontSize: font.lg, fontWeight: weight.medium },
  canvas: { flex: 1, margin: spacing.md, position: "relative" },
  missing: { color: LIGHT, alignSelf: "center", marginTop: spacing.xxl },
  cropBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: LIGHT,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  handle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: LIGHT,
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: DARK,
  },
  tool: { alignItems: "center", gap: 4, minWidth: 48 },
  toolLabel: { fontSize: font.sm, fontWeight: weight.regular },
});
