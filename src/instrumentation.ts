export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWsServer } = await import("./server/ws/server");
    startWsServer();
  }
}
