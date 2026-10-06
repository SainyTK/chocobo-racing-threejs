/** Digital axes match ArrowUp/Down/Left/Right, including diagonal driving. */
export function joystickActions(x: number, y: number): string[] {
  const length = Math.hypot(x, y);
  if (length < .22) return [];
  x /= Math.max(1, length); y /= Math.max(1, length);
  return [x < -.3 ? 'left' : x > .3 ? 'right' : '', y < -.3 ? 'throttle' : y > .3 ? 'brake' : ''].filter(Boolean);
}

export function installTouchControls(options: {
  held: Set<string>;
  enabled: () => boolean;
  onPress: (action: string) => void;
  onCancel: (action: string) => void;
  onLayoutChange: () => void;
}) {
  const pointers = new Map<number, { button: HTMLElement; actions: string[]; joystick: boolean }>();
  const compact = matchMedia('(max-width: 900px)');
  const coarse = matchMedia('(any-pointer: coarse)');
  const sync = () => {
    options.held.clear();
    for (const p of pointers.values()) for (const action of p.actions) options.held.add(action);
  };
  const release = (pointerId: number) => {
    const entry = pointers.get(pointerId);
    if (!entry) return;
    pointers.delete(pointerId);
    sync();
    if (![...pointers.values()].some(p => p.button === entry.button)) {
      entry.button.classList.remove('pressed');
      entry.button.style.removeProperty('--stick-x');
      entry.button.style.removeProperty('--stick-y');
    }
    if (entry.button.hasPointerCapture(pointerId)) entry.button.releasePointerCapture(pointerId);
  };
  const reset = () => {
    for (const id of [...pointers.keys()]) release(id);
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
  const move = (e: PointerEvent) => {
    const entry = pointers.get(e.pointerId);
    if (!entry?.joystick) return;
    const rect = entry.button.getBoundingClientRect(), radius = rect.width / 2;
    const x = (e.clientX - rect.left - radius) / radius, y = (e.clientY - rect.top - rect.height / 2) / radius;
    entry.actions = joystickActions(x, y);
    const scale = radius * .52 / Math.max(1, Math.hypot(x, y));
    entry.button.style.setProperty('--stick-x', `${x * scale}px`);
    entry.button.style.setProperty('--stick-y', `${y * scale}px`);
    sync();
  };
  document.addEventListener('pointerdown', e => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-touch]') : null;
    if (!button || !options.enabled() || e.button !== 0) return;
    e.preventDefault();
    const action = button.dataset.touch!, joystick = action === 'joystick';
    // A second finger must not take ownership of the steering thumb.
    if (joystick && [...pointers.values()].some(p => p.joystick)) return;
    pointers.set(e.pointerId, { button, actions: joystick ? [] : [action], joystick });
    button.classList.add('pressed');
    button.setPointerCapture(e.pointerId);
    if (joystick) move(e); else sync();
    options.onPress(action);
  });
  document.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    document.addEventListener(type, e => {
      if (type !== 'pointerup') {
        for (const action of pointers.get(e.pointerId)?.actions || []) options.onCancel(action);
      }
      release(e.pointerId);
    });
  }
  const gameTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest('#world,.hud') && !target.closest('input,textarea,select,[contenteditable]');
  for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'gesturechange', 'touchmove']) {
    document.addEventListener(type, e => {
      if (options.enabled() && gameTarget(e.target)) e.preventDefault();
    }, { passive: false });
  }
  document.addEventListener('click', e => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-touch]') : null;
    if (button && e.detail === 0 && options.enabled()) options.onPress(button.dataset.touch!);
  });
  return { reset };
}
