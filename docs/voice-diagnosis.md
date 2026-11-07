# Ontorale: Voice System Diagnosis & Architecture Decision

**Document Version:** 1.0  
**Target:** Voice Chat Fix and Baseline Preservation (Milestone 2)  
**Author:** AI Pair Programmer  
**Date:** 2026-11-07

---

## 1. System Classification

The existing voice implementation in **Ontorale** is an **SFU (Selective Forwarding Unit) service** powered by **LiveKit**:

- **Backend:** `livekit-server-sdk` (v2.19.2) integrated in `packages/server/src/voice/LiveKitProvider.ts`, managing room tokens and server-authoritative participant permissions (`RoomServiceClient`).
- **Frontend:** `livekit-client` (v2.23.0) integrated in `packages/client/src/components/VoiceControls.tsx`, connecting to the LiveKit SFU cluster over WebRTC.
- **Control / Signaling:** Carried out over authenticated **Socket.IO** events (`voice:token` and `voice:ready`) implemented in `packages/server/src/socket/handlers.ts`.

---

## 2. Comprehensive Area-by-Area Inspection & Evidence

| Area                             | Status / Observation in Current Codebase                                                                                               | Risk / Issue Identified                                                                                                                                                                                                      | Least Disruptive Remediation                                                                                                                                                                                                                                                                  |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secure Context**               | Client runs over HTTPS in production (Render) and `http://localhost` during local dev.                                                 | Mobile browsers block `navigator.mediaDevices.getUserMedia` silently if loaded over insecure HTTP, presenting as "mic never works".                                                                                          | Add explicit `window.isSecureContext` guard in voice initialization, displaying an unsupported banner if insecure.                                                                                                                                                                            |
| **Permissions**                  | Basic `NotAllowedError` check exists in `VoiceControls.tsx` (lines 75-80, 131-135).                                                    | Specific errors (`NotFoundError`, `NotReadableError`, `OverconstrainedError`) are not differentiated from deliberate denial; `permissionDenied` state can prematurely trap the user.                                         | Differentiate permission errors in store; allow retry without unmounting; keep `micEnabled` independent from permission prompt rejection.                                                                                                                                                     |
| **Local Track & Capture**        | `VoiceControls.tsx` calls `setMicrophoneEnabled(shouldPublish)` inside a `useEffect` on every phase and state change.                  | When switching between public and mafia rooms, `livekit-client` re-invokes `getUserMedia`, triggering duplicate track creation. On iOS Safari and Android Chrome, the second capture track can silence or disable the first. | **Single Capture Track Pattern**: Acquire the capture track exactly once upon the user's first unmute. If published to both public and mafia rooms, clone the track via `mediaStreamTrack.clone()`. Never call `getUserMedia` on phase transitions or reconnects.                             |
| **Mute Logic**                   | 300 ms debounce implemented on `onClick` in `VoiceControls.tsx` (lines 169-170). Stored preference `micEnabled` in `useVoiceStore.ts`. | Track publication was coupled with `canSpeakNow` state directly inside `useEffect`, causing track teardown on phase shifts.                                                                                                  | Decouple stored user intent (`micEnabled`) from server permission. When server revokes speaking rights (e.g. night for citizens, silenced player), disable publish at SDK level while leaving `micEnabled` unchanged; resume when permission is granted. Guard with an in-flight toggle flag. |
| **Signaling**                    | Socket.IO issues tokens via `socket.on('voice:token')` in `packages/server/src/socket/handlers.ts`.                                    | Server token requests lacked per-socket rate limiting, exposing the server to token flooding.                                                                                                                                | Add a rate limiter on `voice:token` requests; restrict Mafia token issuance to verified alive Mafia members.                                                                                                                                                                                  |
| **ICE Servers / TURN**           | Managed by LiveKit Cloud infrastructure (`wss://*.livekit.cloud`).                                                                     | Without TURN, mobile carrier NATs and restrictive Wi-Fi networks fail WebRTC peer connection. LiveKit Cloud provides built-in global TURN relays (`relay` candidates).                                                       | Verify LiveKit Cloud endpoint configuration; handle reconnect gracefully upon network switches.                                                                                                                                                                                               |
| **Scale**                        | SFU topology: each client maintains 1 audio uplink and $N-1$ downlinks to the SFU server.                                              | No $O(N^2)$ mesh bottleneck. Up to 15 players generate manageable single-channel audio downlinks.                                                                                                                            | Use LiveKit's `adaptiveStream: true` and dynacast (already enabled in client).                                                                                                                                                                                                                |
| **Playback**                     | Audio playback requires explicit user gesture on mobile browsers (Safari / Chrome autoplay policies).                                  | Autoplay restrictions can block remote streams before the user taps the screen.                                                                                                                                              | Invoke `room.startAudio()` on the first user interaction. Detect audio playback blocked state and surface a prominent "Tap to enable audio" banner with `playsinline`.                                                                                                                        |
| **Reconnection**                 | `Room.connect` and `disconnect` executed on roomCode change.                                                                           | Backgrounding tabs on iOS Safari causes audio session interruption.                                                                                                                                                          | Listen to `visibilitychange` to resume interrupted audio tracks without toggling the user's chosen `micEnabled` state.                                                                                                                                                                        |
| **Privacy & Server Enforcement** | Separate channels: `ontorale-{code}-pub` and `ontorale-{code}-maf`. Token issued only to alive Mafia.                                  | Non-mafia players cannot join mafia room because token issuance is gated server-side (`channel === 'mafia'` checks `isMafia && player.status === 'alive'`).                                                                  | Enforce participant removal from Mafia room upon death (`roomService.removeParticipant`) and destroy mafia room on `gameOver`.                                                                                                                                                                |
| **Failure Isolation**            | Game state and Socket.IO operate independently of voice.                                                                               | If LiveKit is down or credentials invalid, voice errors must never crash the game screen.                                                                                                                                    | Implement an explicit voice state machine (`idle`, `connecting`, `connected`, `reconnecting`, `failed`, `unsupported`), wrap voice components in a React Error Boundary, and render a voice status chip with a dedicated `Retry` button.                                                      |

---

## 3. Decision Rule (Section 4 Evaluation)

- **Classification:** LiveKit SFU (Option B target architecture is already the baseline).
- **Chosen Path:** **Option A / Hardening**:
  - Fix the local track cloning lifecycle (prevent dual `getUserMedia` invocations).
  - Enforce the explicit voice state machine (`idle | connecting | connected | reconnecting | failed | unsupported`).
  - Introduce React Error Boundary around `VoiceControls`.
  - Add autoplay blocked detection with "Tap to enable audio" banner.
  - Implement on-screen debug panel behind `?voicedebug=1` with `[voice]` structured console logs.
  - Maintain fire-and-forget server sync so voice outages never block timers or state transitions.

---

## 4. Architectural Guarantees (Must Not Regress)

1. **Parity Win Mode ($M \ge N$):** Checked on every mutation via `Game.afterMutation()`.
2. **Detective Limit:** 2 lifetime investigations enforced server-side.
3. **Stalker Limit:** 1 lifetime check of a Citizen-team player.
4. **Constable Disable:** Can target any alive player except self. Special abilities of Doctor, Detective, Police, Silencer, Confuser, Stalker disabled for 2 rounds; Killer's kill cannot be disabled; silent no-effect on Citizen/Mayor with identical cooldown.
5. **Team Visibility & Event Log:** Mafia sees teammates; single-entry event log with RoleAvatar badges; chat pinned on desktop right column; no restored home/lobby subtext.
