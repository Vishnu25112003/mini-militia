import { useState } from 'react';
import type { Room } from '@colyseus/sdk';
import {
  DUAL_PAIRS,
  HOST_SETTING_RANGES,
  WEAPON_IDS,
  isValidDefaultLoadout,
  type LoadoutSlotSelection,
} from '@game/shared';
import type { HostSettingsWire, LoadoutSlotWire } from './game/net/wireTypes';

interface SlotOption {
  key: string;
  label: string;
  selection: LoadoutSlotSelection;
}

const SLOT_OPTIONS: SlotOption[] = [
  ...WEAPON_IDS.map((weapon) => ({
    key: `single:${weapon}`,
    label: weapon,
    selection: { kind: 'single', weapon } as LoadoutSlotSelection,
  })),
  ...DUAL_PAIRS.map(([a, b]) => ({
    key: `dual:${a}:${b}`,
    label: `${a} + ${b} (dual)`,
    selection: { kind: 'dual', weapons: [a, b] } as LoadoutSlotSelection,
  })),
];

function keyForWire(slot: LoadoutSlotWire): string {
  return slot.kind === 'dual' ? `dual:${slot.weapon1}:${slot.weapon2}` : `single:${slot.weapon1}`;
}

function selectionForKey(key: string): LoadoutSlotSelection | undefined {
  return SLOT_OPTIONS.find((o) => o.key === key)?.selection;
}

function formatMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function NumericRow({
  label,
  value,
  format,
  min,
  step,
  isHost,
  minOverride,
  onChange,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
  min: number;
  step: number;
  isHost: boolean;
  minOverride?: number;
  onChange: (next: number) => void;
}) {
  const effectiveMin = Math.max(min, minOverride ?? min);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ fontSize: '13px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          disabled={!isHost || value <= effectiveMin}
          onClick={() => onChange(value - step)}
          style={stepButtonStyle}
        >
          −
        </button>
        <span style={{ fontSize: '13px', minWidth: '48px', textAlign: 'center' }}>
          {format ? format(value) : value}
        </span>
        <button disabled={!isHost} onClick={() => onChange(value + step)} style={stepButtonStyle}>
          +
        </button>
      </div>
    </div>
  );
}

export function HostSettingsPopup({
  room,
  settings,
  isHost,
  playersJoined,
}: {
  room: Room;
  settings: HostSettingsWire;
  isHost: boolean;
  playersJoined: number;
}) {
  const [slot1Key, setSlot1Key] = useState(() => keyForWire(settings.defaultLoadoutSlot1));
  const [slot2Key, setSlot2Key] = useState(() => keyForWire(settings.defaultLoadoutSlot2));

  const send = (payload: Record<string, unknown>) => {
    if (!isHost) return;
    room.send('updateHostSettings', payload);
  };

  const slot1 = selectionForKey(slot1Key);
  const slot2 = selectionForKey(slot2Key);
  const loadoutValid = !!slot1 && !!slot2 && isValidDefaultLoadout(slot1, slot2);

  const applyLoadout = (nextSlot1Key: string, nextSlot2Key: string) => {
    const a = selectionForKey(nextSlot1Key);
    const b = selectionForKey(nextSlot2Key);
    if (!a || !b || !isValidDefaultLoadout(a, b)) return;
    send({ defaultLoadout: [a, b] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '280px' }}>
      <NumericRow
        label="Player count"
        value={settings.playerCount}
        min={HOST_SETTING_RANGES.playerCount.min}
        step={HOST_SETTING_RANGES.playerCount.step}
        isHost={isHost}
        minOverride={Math.max(HOST_SETTING_RANGES.playerCount.min, playersJoined)}
        onChange={(v) => send({ playerCount: v })}
      />
      <NumericRow
        label="Game time"
        value={settings.gameTimeSeconds}
        format={formatMmSs}
        min={HOST_SETTING_RANGES.gameTimeSeconds.min}
        step={HOST_SETTING_RANGES.gameTimeSeconds.step}
        isHost={isHost}
        onChange={(v) => send({ gameTimeSeconds: v })}
      />
      <NumericRow
        label="Map drops"
        value={settings.mapDropsCountdownSeconds}
        format={(v) => `${v}s`}
        min={HOST_SETTING_RANGES.mapDropsCountdownSeconds.min}
        step={HOST_SETTING_RANGES.mapDropsCountdownSeconds.step}
        isHost={isHost}
        onChange={(v) => send({ mapDropsCountdownSeconds: v })}
      />
      <NumericRow
        label="Gravity"
        value={settings.gravity}
        min={HOST_SETTING_RANGES.gravity.min}
        step={HOST_SETTING_RANGES.gravity.step}
        isHost={isHost}
        onChange={(v) => send({ gravity: v })}
      />
      <NumericRow
        label="Boost"
        value={settings.boost}
        min={HOST_SETTING_RANGES.boost.min}
        step={HOST_SETTING_RANGES.boost.step}
        isHost={isHost}
        onChange={(v) => send({ boost: v })}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <input
          type="checkbox"
          checked={settings.defaultLoadoutEnabled}
          disabled={!isHost || (!settings.defaultLoadoutEnabled && !loadoutValid)}
          onChange={(e) => send({ defaultLoadoutEnabled: e.target.checked })}
        />
        Default loadout
      </label>

      {settings.defaultLoadoutEnabled || isHost ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '8px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ fontSize: '11px', color: '#9aa0ac' }}>
            Slot 1 + Slot 2 (a dual pair counts as one slot)
          </div>
          <select
            value={slot1Key}
            disabled={!isHost}
            onChange={(e) => {
              setSlot1Key(e.target.value);
              applyLoadout(e.target.value, slot2Key);
            }}
            style={selectStyle}
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={slot2Key}
            disabled={!isHost}
            onChange={(e) => {
              setSlot2Key(e.target.value);
              applyLoadout(slot1Key, e.target.value);
            }}
            style={selectStyle}
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {!loadoutValid && (
            <div style={{ fontSize: '11px', color: '#e03131' }}>
              Pick two different guns (or a published dual pair in one slot).
            </div>
          )}
        </div>
      ) : null}

      {!isHost && <div style={{ fontSize: '11px', color: '#9aa0ac' }}>Only the host can change these.</div>}
    </div>
  );
}

const stepButtonStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  fontSize: '14px',
  borderRadius: '4px',
  border: '1px solid #374151',
  background: 'transparent',
  color: '#e5e7eb',
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  padding: '6px',
  borderRadius: '4px',
  border: '1px solid #374151',
  background: '#0b0c10',
  color: '#e5e7eb',
  fontSize: '12px',
};
