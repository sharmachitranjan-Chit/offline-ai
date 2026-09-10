import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Icon, { IconName } from '../components/Icon';
import StorageCard from '../components/StorageCard';
import TopBar from '../components/TopBar';
import { DEFAULT_SETTINGS, useLlama } from '../context/LlamaContext';
import { ThemeMode, makeStyles, useColors, useTheme } from '../context/ThemeContext';
import { DeviceInfo, DocKit } from '../native/DocKit';
import { formatBytes } from '../services/modelManager';
import { clearLog, readLog } from '../services/diagnostics';
import { fontSizes, radius, spacing, useLayout } from '../theme';

const APPEARANCE: Array<{ mode: ThemeMode; label: string; icon: IconName }> = [
  { mode: 'system', label: 'System', icon: 'phone' },
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const {
    settings,
    updateSettings,
    resetSettings,
    tuneForDevice,
    activeModel,
    visionEnabled,
    unloadModel,
    refreshInstalled,
  } = useLlama();
  const { mode, setMode } = useTheme();
  const c = useColors();
  const styles = useStyles();
  const layout = useLayout();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [prompt, setPrompt] = useState(settings.systemPrompt);
  const [logPreview, setLogPreview] = useState('');

  const refreshLogPreview = () => {
    readLog().then(text => {
      const lines = text.trim().split('\n');
      setLogPreview(lines.slice(-12).join('\n'));
    });
  };

  useEffect(() => {
    refreshLogPreview();
  }, []);

  useEffect(() => {
    DocKit.getDeviceInfo().then(setDevice);
  }, []);

  useEffect(() => {
    setPrompt(settings.systemPrompt);
  }, [settings.systemPrompt]);

  return (
    <View style={styles.flex}>
      <TopBar title="Settings" leading="back" onLeading={onBack} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingHorizontal: layout.compact ? spacing.lg : spacing.xl,
          paddingBottom: spacing.xxl,
        }}>
        <View style={styles.column}>
          <Section label="Appearance">
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Theme</Text>
              <Text style={styles.help}>
                System follows your phone, including its automatic day/night
                schedule.
              </Text>
              <View style={styles.segment}>
                {APPEARANCE.map(option => {
                  const selected = mode === option.mode;
                  return (
                    <Pressable
                      key={option.mode}
                      onPress={() => setMode(option.mode)}
                      style={[styles.segmentItem, selected && styles.segmentActive]}>
                      <Icon
                        name={option.icon}
                        size={16}
                        color={selected ? c.accent : c.textSecondary}
                        background={selected ? c.accentSoft : c.surface}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          selected && styles.segmentTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Section>

          <Section label="Storage">
            <StorageCard onChanged={refreshInstalled} showTitle={false} />
          </Section>

          <Section label="Instructions">
            <View style={styles.field}>
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
                placeholderTextColor={c.textFaint}
              />
              <Pressable
                onPress={() => {
                  setPrompt(DEFAULT_SETTINGS.systemPrompt);
                  updateSettings({ systemPrompt: DEFAULT_SETTINGS.systemPrompt });
                }}>
                <Text style={styles.link}>Reset to default</Text>
              </Pressable>
            </View>
          </Section>

          <Section label="Tuning">
            <Pressable
              style={styles.field}
              onPress={async () => {
                const ok = await tuneForDevice();
                if (ok) DocKit.getDeviceInfo().then(setDevice);
                Alert.alert(
                  ok ? 'Tuned for this phone' : 'Could not read device info',
                  ok
                    ? 'Context window, reply length, threads and image detail were set from current free RAM and core count. Context changes apply on the next model load.'
                    : 'Try again in a moment.',
                );
              }}>
              <Text style={[styles.fieldLabel, { color: c.accent }]}>
                Tune settings for this device
              </Text>
              <Text style={styles.help}>
                Worth running again after closing other apps, or any time
                things feel too heavy or the phone gets warm.
              </Text>
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
              max={8192}
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

          <Section label="Behaviour">
            <Toggle
              label="Reopen the last model on start"
              help="Loads whatever you used last as soon as the app opens, so it is ready without a trip to the Models screen."
              value={settings.autoLoadLastModel}
              onChange={v => updateSettings({ autoLoadLastModel: v })}
            />
            <Toggle
              label="Always show reasoning"
              help="Reasoning models think before answering. By default that is folded away behind a button on each reply."
              value={settings.showReasoning}
              onChange={v => updateSettings({ showReasoning: v })}
            />
            <Toggle
              label="Show speed under replies"
              help="Tokens per second for each completed answer."
              value={settings.showStats}
              onChange={v => updateSettings({ showStats: v })}
            />
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
          </Section>

          <Section label="Status">
            <View style={styles.field}>
              <Row label="Loaded model" value={activeModel?.label ?? 'None'} />
              <Row
                label="Image input"
                value={visionEnabled ? 'Available' : 'Not available'}
              />
              {device && (
                <>
                  <Row label="Device" value={device.model} />
                  <Row label="Android API" value={`${device.sdk}`} />
                  <Row
                    label="Memory"
                    value={`${formatBytes(device.availRamBytes)} free of ${formatBytes(
                      device.totalRamBytes,
                    )}`}
                  />
                  <Row
                    label="Shared storage free"
                    value={formatBytes(device.freeSharedBytes)}
                  />
                  <Row
                    label="All-files access"
                    value={device.allFilesAccess ? 'Granted' : 'Not granted'}
                  />
                </>
              )}
              {!!activeModel && (
                <Pressable onPress={unloadModel} style={styles.unload}>
                  <Text style={styles.unloadText}>Unload model and free memory</Text>
                </Pressable>
              )}
            </View>
          </Section>

          <Section label="Diagnostics">
            <View style={styles.field}>
              <Text style={styles.help}>
                A local log of loads, generations and errors, so a crash or a
                stuck screen can be diagnosed from evidence. It never leaves the
                phone unless you copy it out.
              </Text>
              <View style={styles.logBox}>
                <Text style={styles.logText} numberOfLines={14} selectable>
                  {logPreview || 'Nothing logged yet.'}
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Pressable
                  style={styles.diagBtn}
                  onPress={async () => {
                    DocKit.setClipboard(await readLog());
                    Alert.alert('Copied', 'The full diagnostics log is on your clipboard.');
                  }}>
                  <Text style={styles.diagBtnText}>Copy full log</Text>
                </Pressable>
                <Pressable style={styles.diagBtn} onPress={refreshLogPreview}>
                  <Text style={styles.diagBtnText}>Refresh</Text>
                </Pressable>
                <Pressable
                  style={styles.diagBtn}
                  onPress={() =>
                    Alert.alert('Clear diagnostics log?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: async () => {
                          await clearLog();
                          refreshLogPreview();
                        },
                      },
                    ])
                  }>
                  <Text style={styles.diagBtnText}>Clear</Text>
                </Pressable>
              </View>
            </View>
          </Section>

          <Pressable
            style={styles.unload}
            onPress={() =>
              Alert.alert(
                'Reset all settings?',
                'Every value on this screen goes back to its default. Models, chats and the models folder are not affected.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: resetSettings },
                ],
              )
            }>
            <Text style={styles.unloadText}>Reset all settings to default</Text>
          </Pressable>

          <Text style={styles.footer}>
            No account, no telemetry, no network calls during inference. The only
            time this app uses the internet is when you ask it to fetch a model
            file.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
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
  const c = useColors();
  const styles = useStyles();
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
            <Icon name="minus" size={13} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.stepValue}>{format(value)}</Text>
          <Pressable
            style={styles.stepBtn}
            onPress={() => onChange(clamp(value + step))}
            hitSlop={6}>
            <Icon name="plus" size={13} color={c.textPrimary} />
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
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: c.surfaceHigh, true: c.accentMuted }}
          thumbColor={value ? c.accent : c.textFaint}
        />
      </View>
      <Text style={styles.help}>{help}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  flex: { flex: 1 },
  column: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  section: { marginTop: spacing.xl },
  sectionLabel: {
    color: c.textFaint,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  field: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: c.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.md,
  },
  help: {
    color: c.textFaint,
    fontSize: fontSizes.xxs,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
    marginTop: spacing.md,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: c.accentSoft },
  segmentText: { color: c.textSecondary, fontSize: fontSizes.sm, fontWeight: '600' },
  segmentTextActive: { color: c.accent },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    color: c.accent,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.sm,
    color: c.textPrimary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    padding: spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  link: {
    color: c.accent,
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
    borderBottomColor: c.borderSoft,
  },
  statusLabel: { color: c.textSecondary, fontSize: fontSizes.xs },
  statusValue: {
    color: c.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  unload: {
    marginTop: spacing.md,
    backgroundColor: c.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  unloadText: { color: c.danger, fontSize: fontSizes.sm, fontWeight: '600' },
  logBox: {
    backgroundColor: c.code,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  logText: {
    color: c.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'monospace',
  },
  diagRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  diagBtn: {
    flex: 1,
    backgroundColor: c.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  diagBtnText: { color: c.textPrimary, fontSize: fontSizes.xs, fontWeight: '600' },
  footer: {
    color: c.textFaint,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.xl,
  },
}));
