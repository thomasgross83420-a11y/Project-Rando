if (new URLSearchParams(location.search).get('diagnostics') === 'gate0') {
  await import('./diagnostic');
} else {
  await import('./app');
}
export {};
