export function installTouchControls(options: {
  held: Set<string>;
  enabled: () => boolean;
  onPress: (action: string) => void;
  onLayoutChange: () => void;
}) {
  const pointers = new Map<number, { button: HTMLElement; action: string }>();
  const compact = matchMedia('(max-width: 900px)');
  const coarse = matchMedia('(any-pointer: coarse)');
  const release = (pointerId: number) => {
    const entry = pointers.get(pointerId);
    if (!entry) return;
    pointers.delete(pointerId);
    if (![...pointers.values()].some(p => p.action === entry.action)) options.held.delete(entry.action);
    if (![...pointers.values()].some(p => p.button === entry.button)) entry.button.classList.remove('pressed');
  };
  const reset = () => {
    const captured = [...pointers.entries()];
    pointers.clear();
    options.held.clear();
    for (const [id, { button }] of captured) {
      button.classList.remove('pressed');
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
  };
  const updateLayout = () => {
    const visible = compact.matches || coarse.matches || navigator.maxTouchPoints > 0;
    document.body.classList.toggle('touch-device', visible);
    reset();
    options.onLayoutChange();
  };
  compact.addEventListener('change', updateLayout);
  coarse.addEventListener('change', updateLayout);
  window.addEventListener('resize', updateLayout);
  updateLayout();
  document.addEventListener('pointerdown', e => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-touch]') : null;
    if (!button || !options.enabled() || e.button !== 0) return;
    e.preventDefault();
    const action = button.dataset.touch!;
    pointers.set(e.pointerId, { button, action });
    options.held.add(action);
    button.classList.add('pressed');
    button.setPointerCapture(e.pointerId);
    options.onPress(action);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    document.addEventListener(type, e => release(e.pointerId));
  }
  // Keyboard and assistive-technology activation does not produce pointerdown.
  document.addEventListener('click', e => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-touch]') : null;
    if (button && e.detail === 0 && options.enabled()) options.onPress(button.dataset.touch!);
  });
  return { reset };
}
