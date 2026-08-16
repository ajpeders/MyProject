import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, shadow, space } from "./theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  variant = "primary",
  busy = false,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        buttonStyles.base,
        buttonStyles[variant],
        pressed && !isDisabled && buttonStyles.pressed,
        isDisabled && buttonStyles.disabled,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={variant === "warning" ? "#161A20" : colors.text} /> : null}
      <Text style={[buttonStyles.text, variant === "warning" && buttonStyles.warningText, textStyle]}>
        {title}
      </Text>
    </Pressable>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[segmentedStyles.wrap, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              segmentedStyles.item,
              active && segmentedStyles.itemActive,
              pressed && segmentedStyles.itemPressed,
            ]}
          >
            <Text style={[segmentedStyles.text, active && segmentedStyles.textActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={headerStyles.wrap}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={headerStyles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={headerStyles.title}>{title}</Text>
        {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={headerStyles.right}>{right}</View> : null}
    </View>
  );
}

export function TextField({
  label,
  style,
  inputStyle,
  ...props
}: TextInputProps & {
  label?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[fieldStyles.wrap, style]}>
      {label ? <Text style={fieldStyles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={colors.textSubtle}
        style={[fieldStyles.input, inputStyle]}
      />
    </View>
  );
}

type PillTone = "primary" | "accent" | "warning" | "danger" | "neutral" | "violet";

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return (
    <View style={[pillStyles.base, pillStyles[tone]]}>
      <Text style={[pillStyles.text, tone === "warning" && pillStyles.warningText]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card style={emptyStyles.card}>
      <Text style={emptyStyles.title}>{title}</Text>
      {body ? <Text style={emptyStyles.body}>{body}</Text> : null}
    </Card>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space.sm,
    borderWidth: 1,
  },
  primary: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  secondary: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  ghost: { backgroundColor: "transparent", borderColor: colors.border },
  danger: { backgroundColor: colors.dangerSoft, borderColor: "#6F2E35" },
  warning: { backgroundColor: colors.warning, borderColor: colors.warning },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  text: { color: colors.text, fontWeight: "700", fontSize: 14 },
  warningText: { color: "#161A20" },
});

const segmentedStyles = StyleSheet.create({
  wrap: {
    minHeight: 44,
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
  },
  itemActive: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  itemPressed: { opacity: 0.72 },
  text: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  textActive: { color: colors.text },
});

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
});

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  right: { alignSelf: "flex-start" },
});

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    color: colors.text,
    backgroundColor: colors.bgSoft,
    fontSize: 15,
  },
});

const pillStyles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderWidth: 1,
  },
  primary: { backgroundColor: colors.primarySoft, borderColor: "#236944" },
  accent: { backgroundColor: colors.accentSoft, borderColor: "#2E4C73" },
  warning: { backgroundColor: colors.warning, borderColor: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, borderColor: "#6F2E35" },
  neutral: { backgroundColor: colors.bgSoft, borderColor: colors.border },
  violet: { backgroundColor: colors.violetSoft, borderColor: "#4F3A75" },
  text: { color: colors.text, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  warningText: { color: "#1D1A12" },
});

const emptyStyles = StyleSheet.create({
  card: { alignItems: "center", gap: 6, paddingVertical: space.xl },
  title: { color: colors.text, fontWeight: "800", fontSize: 16, textAlign: "center" },
  body: { color: colors.textMuted, textAlign: "center", lineHeight: 19 },
});
