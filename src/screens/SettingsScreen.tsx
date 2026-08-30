import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_SETTINGS, useLlama } from '../context/LlamaContext';
import { DeviceInfo, DocKit } from '../native/DocKit';
import { formatBytes } from '../services/modelManager';
import { colors, fontSizes, radius, spacing, useLayout } from '../theme';

export default function SettingsScreen() {
  const { settings, updateSettings, activeModel, visionEnabled, unloadModel } =
    useLlama();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [prompt, setPrompt] = useState(settings.systemPrompt);

  useEffect(() => {
    DocKit.getDeviceInfo().then(setDevice);
  }, []);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: layout.compact ? spacing.lg : spacing.xl,
        paddingBottom: spacing.xxl,
      }}>
      <View style={{ maxWidth: layout.contentWidth, width: '100%', alignSelf: 'center' }}>
        <Text style={styles.title}>Settings</Text>

        <Section label="Instructions">
          <Text style={styles.help}>
            The system prompt shapes everything the model does. Unfiltered
            models in particular tend to follow it closely rather than
            imposing a personality of their own.
          </Text>
          <TextInput
            style={styles.textArea}
            value={prompt}
            onChangeText={setPrompt}
            onBlur={() => updateSettings({ systemPrompt: prompt })}
            multiline
            placeholder="System prompt"
            placeholderTextColor={colors.textFaint}
          />
          <Pressable
            onPress={() => {
              setPrompt(DEFAULT_SETTINGS.systemPrompt);
              updateSettings({ systemPrompt: DEFAULT_SETTINGS.systemPrompt });
            }}>
            <Text style={styles.link}>Reset to default</Text>
          </Pressable>
        </Section>

        <Section label="Generation">
          <Stepper
            label="Temperature"
            help="Lower is more literal and repeatable; higher is more varied."
            value={settings.temperature}
            step={0.1}
            min={0}
            max={2}
            format={v => v.toFixed(1)}
            onChange={v => updateSettings({ temperature: v })}
          />
          <Stepper
            label="Top-p"
            help="Narrows the pool of candidate words. 0.9 suits most models."
            value={settings.topP}
            step={0.05}
            min={0.1}
            max={1}
            format={v => v.toFixed(2)}
            onChange={v => updateSettings({ topP: v })}
          />
          <Stepper
            label="Reply length limit"
            help="Maximum tokens in one reply. Longer replies take proportionally longer and warm the phone more."
            value={settings.maxTokens}
            step={256}
            min={256}
            max={4096}
            format={v => `${v}`}
            onChange={v => updateSettings({ maxTokens: v })}
          />
        </Section>

        <Section label="Performance">
          <Stepper
            label="CPU threads"
            help={`Using every core is rarely fastest — the phone throttles. ${
              device ? `This device reports ${device.cores} cores; ` : ''
            }about half is usually the sweet spot.`}
            value={settings.threads}
            step={1}
            min={1}
            max={12}
            format={v => `${v}`}
            onChange={v => updateSettings({ threads: v })}
          />
          <Stepper
            label="Context window"
            help="How much conversation the model can see at once. Larger uses noticeably more RAM. Takes effect on the next model load."
            value={settings.contextSize}
            step={2048}
            min={2048}
            max={16384}
            format={v => `${v / 1024}k`}
            onChange={v => updateSettings({ contextSize: v })}
          />
          <Stepper
            label="Image detail"
            help="Tokens spent per image. Lower is much faster and cooler; raise it only when fine detail matters."
            value={settings.imageMaxTokens}
            step={128}
            min={128}
            max={2048}
            format={v => `${v}`}
            onChange={v => updateSettings({ imageMaxTokens: v })}
          />
        </Section>

        <Section label="Display">
          <Toggle
            label="Full screen"
            help="Hides the status and navigation bars. Swipe from an edge to bring them back."
            value={settings.immersive}
            onChange={v => updateSettings({ immersive: v })}
          />
          <Toggle
            label="Keep screen on while generating"
            help="Stops the display sleeping mid-reply. Turns itself off once generation finishes."
            value={settings.keepScreenOn}
            onChange={v => updateSettings({ keepScreenOn: v })}
          />
          <Toggle
            label="Always show reasoning"
            help="Reasoning models think before answering. By default that is folded away behind a toggle on each reply."
            value={settings.showReasoning}
            onChange={v => updateSettings({ showReasoning: v })}
          />
        </Section>

        <Section label="Status">
          <Row label="Loaded model" value={activeModel?.label ?? 'None'} />
          <Row label="Image input" value={visionEnabled ? 'Available' : 'Not available'} />
          {device && (
            <>
              <Row label="Device" value={device.model} />
              <Row
                label="Memory"
                value={`${formatBytes(device.availRamBytes)} free of ${formatBytes(
                  device.totalRamBytes,
                )}`}
              />
              <Row label="Storage free" value={formatBytes(device.freeDiskBytes)} />
              <Row label="Downloads folder" value={device.downloadsDir} />
            </>
          )}
          {!!activeModel && (
            <Pressable onPress={unloadModel} style={styles.unload}>
              <Text style={styles.unloadText}>Unload model and free memory</Text>
            </Pressable>
          )}
        </Section>

        <Text style={styles.footer}>
          No account, no telemetry, no network calls during inference. The only
          time this app uses the internet is when you ask it to fetch a model
          file.
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({
  label,
  help,
  value,
  step,
  min,
  max,
  format,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(4))));
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => onChange(clamp(value - step))}
            hitSlop={6}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{format(value)}</Text>
          <Pressable
            style={styles.stepBtn}
            onPress={() => onChange(clamp(value + step))}
            hitSlop={6}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.help}>{help}</Text>
    </View>
  );
}

function Toggle({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.surfaceHigh, true: colors.accentMuted }}
          thumbColor={value ? colors.accent : colors.textFaint}
        />
      </View>
      <Text style={styles.help}>{help}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
  },
  section: { marginTop: spacing.xl },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.md,
  },
  help: {
    color: colors.textFaint,
    fontSize: fontSizes.xxs,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  stepValue: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    padding: spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  link: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  statusLabel: { color: colors.textSecondary, fontSize: fontSizes.xs },
  statusValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  unload: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  unloadText: { color: colors.danger, fontSize: fontSizes.sm, fontWeight: '600' },
  footer: {
    color: colors.textFaint,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.xl,
  },
});
