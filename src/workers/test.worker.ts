self.onmessage = (e: MessageEvent) => {
  const { a, b } = e.data;
  console.log('[TestWorker] Received:', a, b);
  self.postMessage({ result: a + b });
};
