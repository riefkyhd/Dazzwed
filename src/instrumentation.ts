export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("./env");
    serverEnv(); // throws with a readable message if misconfigured
  }
}
