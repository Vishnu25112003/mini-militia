/** One definition of "this is a touch device", shared by the orientation gate and input-mode selection. */
export const IS_TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches;
