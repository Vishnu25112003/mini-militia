import { sandboxSettings } from '../sandboxSettings';

let installed = false;

/**
 * Dev-only artificial lag/packet-loss for the match connection, applied
 * BELOW the Colyseus SDK — at the raw WebSocket's `send()` — rather than by
 * delaying the SDK's own `input.send()` call.
 *
 * This matters: the Reconciler predicts a step the moment `input.send()` is
 * called (see `onSend` in the SDK), so delaying that call would delay local
 * prediction too — defeating the entire point of testing "does my own
 * movement stay instant despite lag". Patching the transport instead lets
 * `input.send()` fire immediately (instant local prediction, exactly like a
 * real network, where the call is fire-and-forget) while the bytes
 * genuinely arrive at the server late or not at all.
 *
 * Only delays the outgoing (client→server) leg — good enough to test "does
 * my prediction stay smooth", not a full round-trip latency simulator.
 */
export function installSimulatedNetworkConditions() {
  if (installed) return;
  // No-op outside a browser (e.g. a Node-based integration test importing
  // this module transitively) — there's no `window.WebSocket` to patch.
  if (typeof window === 'undefined') return;
  installed = true;

  const NativeWebSocket = window.WebSocket;

  class ThrottledWebSocket extends NativeWebSocket {
    send(data: Parameters<WebSocket['send']>[0]) {
      const { artificialLagMs, packetLossPercent } = sandboxSettings;

      if (packetLossPercent > 0 && Math.random() * 100 < packetLossPercent) {
        return; // silently dropped, as a lost packet would be
      }

      if (artificialLagMs > 0) {
        setTimeout(() => super.send(data), artificialLagMs);
      } else {
        super.send(data);
      }
    }
  }

  window.WebSocket = ThrottledWebSocket;
}
