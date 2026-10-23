import { useEffect, useState } from 'react';
import { MOVEMENT, type MovementConfig } from '@game/shared';
import {
  debugState,
  flags,
  resetTuning,
  setHostSetting,
  setMovementValue,
  telemetry,
} from '../game/sandbox/sandboxState';
import { hasCoarsePointer } from '../lib/orientation';

interface SliderSpec {
  key: keyof MovementConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

// Movement numbers that can be tuned live. The shared config is not modified: "Copy values" prints what to paste
// into shared/config/movement.ts once it feels right (Phase 03, task 5).
const TUNING: SliderSpec[] = [
  { key: 'walkSpeed', label: 'Walk speed', min: 80, max: 420, step: 10 },
  { key: 'airSpeed', label: 'Air speed', min: 80, max: 420, step: 10 },
  { key: 'groundAccel', label: 'Ground accel', min: 400, max: 6000, step: 100 },
  { key: 'airAccel', label: 'Air accel', min: 200, max: 4000, step: 50 },
  { key: 'gravity', label: 'Gravity (px/s²)', min: 400, max: 3000, step: 50 },
  { key: 'maxFallSpeed', label: 'Max fall speed', min: 300, max: 1800, step: 50 },
  { key: 'jetThrust', label: 'Jet thrust', min: 1200, max: 6000, step: 100 },
  { key: 'maxRiseSpeed', label: 'Max rise speed', min: 150, max: 800, step: 10 },
  { key: 'crouchSpeedFactor', label: 'Crouch speed ×', min: 0.2, max: 1, step: 0.05 },
];

const fmt = (n: number) => (Math.abs(n) < 100 ? n.toFixed(1) : Math.round(n).toString());

/** Dev-only panel for the sandbox: host-setting sliders, live movement tuning, and readouts. */
export default function DebugPanel() {
  // start collapsed on phones / small screens so it never covers the touch joysticks
  const [open, setOpen] = useState(
    () => !(hasCoarsePointer() || flags.forceTouch || window.innerWidth < 900),
  );
  const [, tick] = useState(0);
  const [copied, setCopied] = useState('');

  // telemetry changes every frame; refresh the readout a few times a second
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, []);

  const set = (k: 'gravity' | 'boost', v: number) => {
    setHostSetting(k, v);
    tick((n) => n + 1);
  };
  const setMove = (k: keyof MovementConfig, v: number) => {
    setMovementValue(k, v);
    tick((n) => n + 1);
  };

  const changed = TUNING.filter((t) => debugState.movement[t.key] !== MOVEMENT[t.key]).map(
    (t) => `  ${t.key}: ${debugState.movement[t.key]},`,
  );
  const copy = async () => {
    const text = changed.length
      ? `// shared/config/movement.ts — changed values\n${changed.join('\n')}`
      : '// no changes: the shared config already matches';
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied!');
    } catch {
      setCopied(text);
    }
    window.setTimeout(() => setCopied(''), 4000);
  };

  return (
    <div
      data-testid="debug-panel"
      className="absolute top-2 left-2 z-10 w-64 rounded-lg bg-black/70 p-2 text-[11px] text-stone-200 backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className="mb-1 w-full text-left font-bold text-amber-300" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} DEBUG (dev only)
      </button>
      {open && (
        <>
          <Slider
            label="Gravity (host setting)"
            value={debugState.gravity}
            min={0}
            max={100}
            step={10}
            onChange={(v) => set('gravity', v)}
          />
          <Slider
            label="Boost (host setting)"
            value={debugState.boost}
            min={0}
            max={100}
            step={10}
            onChange={(v) => set('boost', v)}
          />
          <div className="mt-1 border-t border-white/10 pt-1 font-bold text-stone-400">Movement tuning</div>
          {TUNING.map((t) => (
            <Slider
              key={t.key}
              label={t.label}
              value={debugState.movement[t.key]}
              min={t.min}
              max={t.max}
              step={t.step}
              onChange={(v) => setMove(t.key, v)}
            />
          ))}
          <div className="mt-1 flex gap-1">
            <button className="flex-1 rounded bg-amber-400 px-1 py-0.5 font-bold text-black" onClick={copy}>
              Copy values
            </button>
            <button
              className="flex-1 rounded bg-white/15 px-1 py-0.5"
              onClick={() => {
                resetTuning();
                tick((n) => n + 1);
              }}
            >
              Reset
            </button>
          </div>
          {copied && (
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-emerald-300">
              {copied}
            </pre>
          )}
          <div
            data-testid="telemetry"
            className="mt-1 grid grid-cols-2 gap-x-2 border-t border-white/10 pt-1 font-mono text-[10px]"
          >
            <span>x {fmt(telemetry.x)}</span>
            <span>y {fmt(telemetry.y)}</span>
            <span>vx {fmt(telemetry.vx)}</span>
            <span>vy {fmt(telemetry.vy)}</span>
            <span>fuel {fmt(telemetry.fuel)}</span>
            <span>fps {Math.round(telemetry.fps)}</span>
            <span>ground {String(telemetry.onGround)}</span>
            <span>crouch {String(telemetry.crouching)}</span>
            <span>flying {String(telemetry.flying)}</span>
            <span>ticks {telemetry.ticks}</span>
            <span>zoom {telemetry.zoomLabel}</span>
            <span>grenade {telemetry.grenadeLabel}</span>
            <span className="col-span-2">last action: {telemetry.lastAction}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-amber-200">
          {Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        className="h-3 w-full accent-amber-400"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
