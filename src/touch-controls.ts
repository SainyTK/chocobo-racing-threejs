import { steerFromOffset } from './touch-steering.ts';

interface Hold { control: HTMLElement; captor: HTMLElement; actions: string[] }
interface Steering { pointerId: number; pad: HTMLElement; value: number }

const controlAt = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[data-touch]') : null;
const actionsOf = (control: HTMLElement) => control.dataset.hold?.split(' ') ?? [control.dataset.touch!];

export function installTouchControls(options: {
  held: Set<string>;
  enabled: () => boolean;
  onPress: (action: string) => void;
  onCancel: (action: string) => void;
  onLayoutChange: () => void;
}) {
  const holds = new Map<number, Hold>();
  let steering: Steering | null = null, pressed = new Set<HTMLElement>();
  const compact = matchMedia('(max-width: 900px)');
  const coarse = matchMedia('(any-pointer: coarse)');
  const render = () => {
    options.held.clear();
    const active = new Set<HTMLElement>();
    for (const hold of holds.values()) {
      active.add(hold.control);
      for (const action of hold.actions) options.held.add(action);
    }
    if (steering) active.add(steering.pad);
    for (const control of pressed) if (!active.has(control)) control.classList.remove('pressed');
    for (const control of active) control.classList.add('pressed');
    pressed = active;
  };
  const release = (pointerId: number) => {
    const hold = holds.get(pointerId);
    const captor = hold?.captor ?? (steering?.pointerId === pointerId ? steering.pad : null);
    if (!captor) return;
    holds.delete(pointerId);
    if (steering?.pointerId === pointerId) {
      steering.pad.style.removeProperty('--steer-offset');
      steering = null;
    }
    render();
    if (captor.hasPointerCapture(pointerId)) captor.releasePointerCapture(pointerId);
  };
  const reset = () => {
    for (const id of [...holds.keys()]) release(id);
    if (steering) release(steering.pointerId);
    options.held.clear();
  };
  const updateLayout = () => {
    document.body.classList.toggle('touch-device', compact.matches || coarse.matches || navigator.maxTouchPoints > 0);
    reset();
    options.onLayoutChange();
  };
  compact.addEventListener('change', updateLayout);
  coarse.addEventListener('change', updateLayout);
  window.addEventListener('resize', updateLayout);
  window.addEventListener('orientationchange', updateLayout);
  screen.orientation?.addEventListener('change', updateLayout);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  updateLayout();
  const steerTo = (e: PointerEvent) => {
    const rect = steering!.pad.getBoundingClientRect();
    const offset = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    steering!.value = steerFromOffset(offset);
    steering!.pad.style.setProperty('--steer-offset', String(Math.max(-1, Math.min(1, offset))));
  };
  document.addEventListener('pointerdown', e => {
    const control = controlAt(e.target);
    if (!control || !options.enabled() || e.button !== 0) return;
    e.preventDefault();
    const action = control.dataset.touch!;
    if (action === 'steer') {
      // A second finger must not take ownership of the steering thumb.
      if (steering) return;
      steering = { pointerId: e.pointerId, pad: control, value: 0 };
      steerTo(e);
    } else holds.set(e.pointerId, { control, captor: control, actions: actionsOf(control) });
    control.setPointerCapture(e.pointerId);
    render();
    options.onPress(action);
  });
  document.addEventListener('pointermove', e => {
    if (steering?.pointerId === e.pointerId) {
      steerTo(e);
      return;
    }
    // Inside a slide group the thumb rolls from pedal to pedal without lifting.
    const hold = holds.get(e.pointerId), group = hold?.control.closest('[data-touch-slide]');
    if (!hold || !group) return;
    const next = controlAt(document.elementFromPoint(e.clientX, e.clientY));
    if (!next || next === hold.control || next.closest('[data-touch-slide]') !== group) return;
    holds.set(e.pointerId, { ...hold, control: next, actions: actionsOf(next) });
    render();
    options.onPress(next.dataset.touch!);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    document.addEventListener(type, e => {
      if (type !== 'pointerup') {
        for (const action of holds.get(e.pointerId)?.actions || []) options.onCancel(action);
      }
      release(e.pointerId);
    });
  }
  const gameTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest('#world,.hud') && !target.closest('input,textarea,select,[contenteditable]');
  for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'gesturechange', 'touchmove', 'dblclick']) {
    document.addEventListener(type, e => {
      if (options.enabled() && gameTarget(e.target)) e.preventDefault();
    }, { passive: false });
  }
  document.addEventListener('click', e => {
    const control = controlAt(e.target);
    if (control && e.detail === 0 && options.enabled()) options.onPress(control.dataset.touch!);
  });
  return { reset, steer: () => steering?.value ?? 0 };
}
