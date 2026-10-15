import { NAME_RULES, ROOM_CODE_RULES } from '../config/identity.js';

export function validateName(name: string): boolean {
  return (
    name.length >= NAME_RULES.minLength &&
    name.length <= NAME_RULES.maxLength &&
    NAME_RULES.pattern.test(name)
  );
}

/** `random` is injectable so callers (and tests) don't depend on `Math.random`. */
export function generateRoomCode(random: () => number = Math.random): string {
  const { charset, length } = ROOM_CODE_RULES;
  let code = '';
  for (let i = 0; i < length; i++) {
    code += charset[Math.floor(random() * charset.length)];
  }
  return code;
}
