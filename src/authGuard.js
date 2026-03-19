var _dispatched = false;

export function dispatchAuthRequired() {
  if (_dispatched) return;
  _dispatched = true;
  window.dispatchEvent(new Event("auth-required"));
}

export function resetAuthGuard() {
  _dispatched = false;
}
