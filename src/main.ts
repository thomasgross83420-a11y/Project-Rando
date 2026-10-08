if (new URLSearchParams(location.search).get('diagnostics') === 'gate0') {
  await import('./diagnostic');
} else if (new URLSearchParams(location.search).has('legacy')) {
  await import('./app');
} else {
  await import('./game/app');
}
export {};
