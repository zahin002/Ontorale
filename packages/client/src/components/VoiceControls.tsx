import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { useGameStore } from '../store/useGameStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { Mic, MicOff } from 'lucide-react';
import type { Phase } from '@ontorale/shared';

interface VoiceControlsProps {
  roomCode: string;
  phase: Phase;
  alive: boolean;
  isMafia: boolean;
  silenced: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  roomCode,
  phase,
  alive,
  isMafia,
  silenced,
}) => {
  const { socket } = useGameStore();
  const { micEnabled, permissionDenied, toggleMic, setPermissionDenied } = useVoiceStore();

  const [pubRoom, setPubRoom] = useState<Room | null>(null);
  const [mafRoom, setMafRoom] = useState<Room | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean>(true);

  const lastClickRef = useRef<number>(0);

  // Determine which room can publish to based on Section 11 matrix
  const canPublishInPub =
    alive && !silenced && (phase === 'lobby' || phase === 'discussion' || phase === 'gameOver');
  const canPublishInMaf = alive && isMafia && phase === 'night';
  const canSpeakNow = canPublishInPub || canPublishInMaf;

  useEffect(() => {
    if (!socket || !roomCode) return;

    let active = true;

    async function initVoice() {
      // 1. Request public room token
      socket?.emit(
        'voice:token',
        { channel: 'public' },
        async (res: { ok: boolean; data?: { url: string; token: string }; error?: string }) => {
          if (!active) return;
          if (!res.ok) {
            if (res.error === 'voiceUnavailable') {
              setVoiceAvailable(false);
            }
            return;
          }

          try {
            const room = new Room({
              adaptiveStream: true,
              dynacast: true,
            });

            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
              const meSpeaking = speakers.some((s) => s.isLocal);
              setIsSpeaking(meSpeaking);
            });

            if (res.data) {
              await room.connect(res.data.url, res.data.token);
              setPubRoom(room);
              socket?.emit('voice:ready', { channel: 'public' });
            }
          } catch (err: unknown) {
            if (
              err instanceof Error &&
              (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            ) {
              setPermissionDenied(true);
            }
          }
        },
      );

      // 2. If mafia and alive, request mafia room token
      if (isMafia && alive) {
        socket?.emit(
          'voice:token',
          { channel: 'mafia' },
          async (res: { ok: boolean; data?: { url: string; token: string }; error?: string }) => {
            if (!active || !res.ok) return;

            try {
              const room = new Room({
                adaptiveStream: true,
                dynacast: true,
              });
              if (res.data) {
                await room.connect(res.data.url, res.data.token);
                setMafRoom(room);
                socket?.emit('voice:ready', { channel: 'mafia' });
              }
            } catch {
              // Ignore mafia channel connection failure
            }
          },
        );
      }
    }

    initVoice();

    return () => {
      active = false;
      pubRoom?.disconnect();
      mafRoom?.disconnect();
    };
  }, [socket, roomCode, isMafia, alive]);

  // Handle publishing based on stored micEnabled and current server permissions
  useEffect(() => {
    async function updateMicPublish() {
      const shouldPublish = micEnabled && !permissionDenied && canSpeakNow;

      if (pubRoom) {
        try {
          const shouldPubRoom = shouldPublish && canPublishInPub;
          await pubRoom.localParticipant.setMicrophoneEnabled(shouldPubRoom);
        } catch (err) {
          if (
            err instanceof Error &&
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ) {
            setPermissionDenied(true);
          }
        }
      }

      if (mafRoom) {
        try {
          const shouldMafRoom = shouldPublish && canPublishInMaf;
          await mafRoom.localParticipant.setMicrophoneEnabled(shouldMafRoom);
        } catch (err) {
          if (
            err instanceof Error &&
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ) {
            setPermissionDenied(true);
          }
        }
      }
    }

    updateMicPublish();
  }, [
    micEnabled,
    canSpeakNow,
    canPublishInPub,
    canPublishInMaf,
    pubRoom,
    mafRoom,
    permissionDenied,
  ]);

  if (!voiceAvailable) return null;

  const handleClick = async () => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) return; // 300ms debounce
    lastClickRef.current = now;

    // Handle iOS Safari audio unlock
    try {
      if (pubRoom) await pubRoom.startAudio();
      if (mafRoom) await mafRoom.startAudio();
    } catch {
      // Audio unlock best-effort
    }

    toggleMic();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={!canSpeakNow || permissionDenied}
        aria-pressed={micEnabled}
        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
          permissionDenied
            ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            : !canSpeakNow
              ? 'bg-slate-900 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
              : micEnabled
                ? isSpeaking
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md animate-pulse'
                  : 'bg-emerald-700 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
        }`}
        title={
          permissionDenied
            ? 'মাইক্রোফোনের অনুমতি প্রত্যাখ্যাত হয়েছে'
            : !canSpeakNow
              ? 'এই পর্বে আপনার কথা বলার অনুমতি নেই'
              : !micEnabled
                ? 'মাইক্রোফোন চালু করুন'
                : 'মাইক্রোফোন বন্ধ করুন'
        }
      >
        {!micEnabled || !canSpeakNow || permissionDenied ? (
          <MicOff className="w-3.5 h-3.5" />
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
        <span>
          {permissionDenied
            ? 'মাইক বন্ধ'
            : !canSpeakNow
              ? 'মিউট'
              : !micEnabled
                ? 'মিউট'
                : isSpeaking
                  ? 'কথা বলছেন...'
                  : 'আনমিউট'}
        </span>
      </button>
    </div>
  );
};
