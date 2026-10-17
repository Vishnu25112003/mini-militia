import {
  defaultTouchLayout,
  saveTouchLayout,
  clearSavedTouchLayout,
  type ControlId,
  type ControlLayout,
} from './touchLayout';

/** What any draggable/resizable touch control exposes so the edit-mode UI can move/scale it without knowing its concrete type. */
export interface EditableControl {
  getLayout(): ControlLayout;
  setLayout(layout: ControlLayout): void;
  setEditable(editable: boolean): void;
}

/**
 * Touch controls live in whichever Phaser scene is currently running (owned
 * by `TouchInputSource`/`MatchScene`), while the "Edit controls" UI lives in
 * React with no reference to that scene. This registry is the connection:
 * each control registers itself on creation, and the React UI calls these
 * plain functions directly — no event bus needed since both sides can just
 * import this module.
 */
const registry = new Map<ControlId, EditableControl>();
let registeredWidth = 0;
let registeredHeight = 0;

export function registerControl(id: ControlId, control: EditableControl, screenWidth: number, screenHeight: number) {
  registry.set(id, control);
  registeredWidth = screenWidth;
  registeredHeight = screenHeight;
}

export function unregisterControl(id: ControlId) {
  registry.delete(id);
}

/** True only while a match (or sandbox) scene with touch controls is actually running. */
export function hasRegisteredTouchControls(): boolean {
  return registry.size > 0;
}

export function setAllControlsEditable(editable: boolean) {
  for (const control of registry.values()) control.setEditable(editable);
}

export function saveCurrentTouchLayout() {
  const layout: Partial<Record<ControlId, ControlLayout>> = {};
  for (const [id, control] of registry) layout[id] = control.getLayout();
  saveTouchLayout(layout as Record<ControlId, ControlLayout>);
}

export function resetTouchLayoutToDefault() {
  const defaults = defaultTouchLayout(registeredWidth, registeredHeight);
  for (const [id, control] of registry) control.setLayout(defaults[id]);
  clearSavedTouchLayout();
}
