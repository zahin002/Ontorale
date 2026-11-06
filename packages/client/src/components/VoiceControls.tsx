import React, { useState, useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { useGameStore } from '../store/useGameStore';
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
  const [pubRoom, setPubRoom] = useState<Room | null>(null);
  const [mafRoom, setMafRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Determine which room can publish to based on Section 11 matrix
  const canPublishInPub =
    alive && !silenced && (phase === 'lobby' || phase === 'discussion' || phase === 'gameOver');
  const canPublishInMaf = alive && isMafia && phase === 'night';

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

  // Handle mute / unmute publishing per phase matrix
  useEffect(() => {
    async function updateMicPublish() {
      if (!isMuted && !permissionDenied) {
        if (canPublishInPub && pubRoom) {
          try {
            await pubRoom.localParticipant.setMicrophoneEnabled(true);
          } catch {
            setPermissionDenied(true);
          }
        } else if (pubRoom) {
          await pubRoom.localParticipant.setMicrophoneEnabled(false);
        }

        if (canPublishInMaf && mafRoom) {
          try {
            await mafRoom.localParticipant.setMicrophoneEnabled(true);
          } catch {
            setPermissionDenied(true);
          }
        } else if (mafRoom) {
          await mafRoom.localParticipant.setMicrophoneEnabled(false);
        }
      } else {
        if (pubRoom) await pubRoom.localParticipant.setMicrophoneEnabled(false);
        if (mafRoom) await mafRoom.localParticipant.setMicrophoneEnabled(false);
      }
    }

    updateMicPublish();
  }, [isMuted, canPublishInPub, canPublishInMaf, pubRoom, mafRoom, permissionDenied]);

  if (!voiceAvailable) return null;

  const canSpeakNow = canPublishInPub || canPublishInMaf;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsMuted((prev) => !prev)}
        disabled={!canSpeakNow || permissionDenied}
        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
          permissionDenied
            ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            : !canSpeakNow
              ? 'bg-slate-900 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
              : !isMuted
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
              : isMuted
                ? 'মাইক্রোফোন চালু করুন'
                : 'মাইক্রোফোন বন্ধ করুন'
        }
      >
        {isMuted || !canSpeakNow || permissionDenied ? (
          <MicOff className="w-3.5 h-3.5" />
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
        <span>
          {permissionDenied
            ? 'মাইক বন্ধ'
            : isMuted || !canSpeakNow
              ? 'মিউট'
              : isSpeaking
                ? 'কথা বলছেন...'
                : 'আনমিউট'}
        </span>
      </button>
    </div>
  );
};
