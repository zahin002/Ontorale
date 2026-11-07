import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  createLocalAudioTrack,
  LocalAudioTrack,
  RemoteTrack,
} from 'livekit-client';
import { useGameStore } from '../store/useGameStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { Mic, MicOff, RefreshCw, Volume2, Bug } from 'lucide-react';
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
  const {
    voiceStatus,
    micEnabled,
    permissionDenied,
    audioPlaybackBlocked,
    retryCount,
    setVoiceStatus,
    toggleMic,
    setPermissionDenied,
    setAudioPlaybackBlocked,
    retryConnection,
  } = useVoiceStore();

  const isDebugMode =
    typeof window !== 'undefined' && window.location.search.includes('voicedebug=1');

  const [pubRoom, setPubRoom] = useState<Room | null>(null);
  const [mafRoom, setMafRoom] = useState<Room | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(isDebugMode);

  const lastClickRef = useRef<number>(0);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const mafiaAudioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Determine speaking permissions
  const canPublishInPub =
    alive && !silenced && (phase === 'lobby' || phase === 'discussion' || phase === 'gameOver');
  const canPublishInMaf = alive && isMafia && phase === 'night';
  const canSpeakNow = canPublishInPub || canPublishInMaf;

  // Single capture track helper
  const getOrCreateLocalTrack = useCallback(async (): Promise<LocalAudioTrack> => {
    if (localAudioTrackRef.current) {
      return localAudioTrackRef.current;
    }
    const track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    localAudioTrackRef.current = track;
    return track;
  }, []);

  // Cleanup helper for tracks
  const stopAllTracks = useCallback(() => {
    if (localAudioTrackRef.current) {
      try {
        localAudioTrackRef.current.stop();
      } catch {
        // Track stop best-effort
      }
      localAudioTrackRef.current = null;
    }
    if (mafiaAudioTrackRef.current) {
      try {
        mafiaAudioTrackRef.current.stop();
      } catch {
        // Track stop best-effort
      }
      mafiaAudioTrackRef.current = null;
    }
  }, []);

  // Room connection lifecycle
  useEffect(() => {
    if (!socket || !roomCode) return;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setVoiceStatus('unsupported');
      return;
    }

    let active = true;
    setVoiceStatus('connecting');

    // 1. Request public room token
    socket.emit(
      'voice:token',
      { channel: 'public' },
      async (res: { ok: boolean; data?: { url: string; token: string }; error?: string }) => {
        if (!active) return;
        if (!res.ok) {
          if (res.error === 'voiceUnavailable') {
            setVoiceStatus('unsupported');
          } else {
            setVoiceStatus('failed');
          }
          return;
        }

        try {
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });

          room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            if (!active) return;
            const meSpeaking = speakers.some((s) => s.isLocal);
            setIsSpeaking(meSpeaking);
          });

          room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (!active) return;
            if (track.kind === Track.Kind.Audio) {
              const audioElement = track.attach();
              document.body.appendChild(audioElement);
            }
          });

          room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio) {
              track.detach().forEach((el) => el.remove());
            }
          });

          room.on(RoomEvent.ConnectionStateChanged, (state) => {
            if (!active) return;
            if (state === ConnectionState.Connecting) {
              setVoiceStatus('connecting');
            } else if (state === ConnectionState.Connected) {
              setVoiceStatus('connected');
              if (!room.canPlaybackAudio) {
                setAudioPlaybackBlocked(true);
              }
            } else if (state === ConnectionState.Reconnecting) {
              setVoiceStatus('reconnecting');
            } else if (state === ConnectionState.Disconnected) {
              setVoiceStatus('idle');
            }
          });

          room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
            if (!active) return;
            setAudioPlaybackBlocked(!room.canPlaybackAudio);
          });

          if (res.data) {
            await room.connect(res.data.url, res.data.token);
            if (!active) {
              room.disconnect();
              return;
            }
            // Attach existing remote audio tracks
            room.remoteParticipants.forEach((p) => {
              p.trackPublications.forEach((pub) => {
                if (pub.track && pub.track.kind === Track.Kind.Audio) {
                  const audioElement = pub.track.attach();
                  document.body.appendChild(audioElement);
                }
              });
            });
            setPubRoom(room);
            setVoiceStatus('connected');
            if (!room.canPlaybackAudio) {
              setAudioPlaybackBlocked(true);
            }
            socket.emit('voice:ready', { channel: 'public' });
          }
        } catch (err: unknown) {
          if (!active) return;
          if (
            err instanceof Error &&
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          ) {
            setPermissionDenied(true);
          } else {
            setVoiceStatus('failed');
          }
        }
      },
    );

    // 2. Request mafia room token if mafia and alive
    if (isMafia && alive) {
      socket.emit(
        'voice:token',
        { channel: 'mafia' },
        async (res: { ok: boolean; data?: { url: string; token: string }; error?: string }) => {
          if (!active || !res.ok) return;

          try {
            const mRoom = new Room({
              adaptiveStream: true,
              dynacast: true,
            });

            mRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
              if (!active) return;
              if (track.kind === Track.Kind.Audio) {
                const audioElement = track.attach();
                document.body.appendChild(audioElement);
              }
            });

            mRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
              if (track.kind === Track.Kind.Audio) {
                track.detach().forEach((el) => el.remove());
              }
            });

            mRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
              if (!active) return;
              if (!mRoom.canPlaybackAudio) {
                setAudioPlaybackBlocked(true);
              }
            });

            if (res.data) {
              await mRoom.connect(res.data.url, res.data.token);
              if (!active) {
                mRoom.disconnect();
                return;
              }
              // Attach existing remote audio tracks in mafia room
              mRoom.remoteParticipants.forEach((p) => {
                p.trackPublications.forEach((pub) => {
                  if (pub.track && pub.track.kind === Track.Kind.Audio) {
                    const audioElement = pub.track.attach();
                    document.body.appendChild(audioElement);
                  }
                });
              });
              setMafRoom(mRoom);
              socket.emit('voice:ready', { channel: 'mafia' });
            }
          } catch {
            // Non-fatal mafia room connect failure
          }
        },
      );
    }

    return () => {
      active = false;
      stopAllTracks();
      const detachAndDisconnect = (r: Room | null) => {
        if (!r) return;
        r.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (pub.track) {
              pub.track.detach().forEach((el) => el.remove());
            }
          });
        });
        r.disconnect();
      };
      detachAndDisconnect(pubRoom);
      detachAndDisconnect(mafRoom);
    };
  }, [
    socket,
    roomCode,
    isMafia,
    alive,
    retryCount,
    setVoiceStatus,
    setPermissionDenied,
    setAudioPlaybackBlocked,
    stopAllTracks,
  ]);

  // Handle visibility change for mobile browser audio session restoration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (pubRoom && !pubRoom.canPlaybackAudio) {
          pubRoom.startAudio().catch(() => {});
        }
        if (mafRoom && !mafRoom.canPlaybackAudio) {
          mafRoom.startAudio().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pubRoom, mafRoom]);

  // Auto-unlock audio playback on any user interaction (click/touch anywhere on screen)
  useEffect(() => {
    const handleInteraction = () => {
      if (pubRoom && !pubRoom.canPlaybackAudio) {
        pubRoom
          .startAudio()
          .then(() => setAudioPlaybackBlocked(false))
          .catch(() => {});
      }
      if (mafRoom && !mafRoom.canPlaybackAudio) {
        mafRoom
          .startAudio()
          .then(() => setAudioPlaybackBlocked(false))
          .catch(() => {});
      }
    };

    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [pubRoom, mafRoom, setAudioPlaybackBlocked]);

  // Audio track publish synchronization
  useEffect(() => {
    let cancelled = false;

    async function syncPublishing() {
      const shouldPublish = micEnabled && !permissionDenied && canSpeakNow;

      // 1. Public Room Publishing
      if (pubRoom && pubRoom.state === ConnectionState.Connected) {
        const shouldPubRoom = shouldPublish && canPublishInPub;
        const pub = pubRoom.localParticipant.getTrackPublication(Track.Source.Microphone);

        if (shouldPubRoom) {
          try {
            if (!pub) {
              const track = await getOrCreateLocalTrack();
              if (cancelled) return;
              await pubRoom.localParticipant.publishTrack(track);
            } else if (pub.track) {
              await pub.track.unmute();
            }
          } catch (err) {
            if (
              err instanceof Error &&
              (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            ) {
              setPermissionDenied(true);
            }
          }
        } else {
          if (pub && pub.track) {
            try {
              await pub.track.mute();
            } catch {
              // Ignore mute failure
            }
          }
        }
      }

      // 2. Mafia Room Publishing (Dual-room single capture with clone)
      if (mafRoom && mafRoom.state === ConnectionState.Connected) {
        const shouldMafRoom = shouldPublish && canPublishInMaf;
        const pub = mafRoom.localParticipant.getTrackPublication(Track.Source.Microphone);

        if (shouldMafRoom) {
          try {
            if (!pub) {
              const primaryTrack = await getOrCreateLocalTrack();
              if (cancelled) return;
              // Clone the underlying media stream track without re-calling getUserMedia
              const clonedMediaTrack = primaryTrack.mediaStreamTrack.clone();
              const mafiaTrack = new LocalAudioTrack(clonedMediaTrack);
              mafiaAudioTrackRef.current = mafiaTrack;
              await mafRoom.localParticipant.publishTrack(mafiaTrack);
            } else if (pub.track) {
              await pub.track.unmute();
            }
          } catch (err) {
            if (
              err instanceof Error &&
              (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            ) {
              setPermissionDenied(true);
            }
          }
        } else {
          if (pub && pub.track) {
            try {
              await pub.track.mute();
            } catch {
              // Ignore mute failure
            }
          }
        }
      }
    }

    syncPublishing();

    return () => {
      cancelled = true;
    };
  }, [
    micEnabled,
    permissionDenied,
    canSpeakNow,
    canPublishInPub,
    canPublishInMaf,
    pubRoom,
    mafRoom,
    getOrCreateLocalTrack,
    setPermissionDenied,
  ]);

  if (voiceStatus === 'unsupported') {
    return (
      <div className="flex items-center gap-2 relative">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs"
          title="ভয়েস চ্যাট এই মুহূর্তে অনুপলব্ধ (LiveKit কনফিগারেশন অনুপস্থিত বা সংযোগ ব্যর্থ)"
        >
          <MicOff className="w-3.5 h-3.5 text-slate-600" />
          <span>ভয়েস বন্ধ</span>
        </div>
        {isDebugMode && (
          <div className="absolute right-0 top-10 w-64 p-3 bg-slate-950/95 border border-amber-500/50 rounded-lg shadow-2xl text-[11px] text-slate-300 font-mono z-50 backdrop-blur-sm">
            <div className="font-bold text-amber-400 mb-1 border-b border-amber-500/30 pb-1">
              ভয়েস ডায়াগনস্টিক (?voicedebug=1)
            </div>
            <div className="text-amber-300">Status: unsupported</div>
            <div className="text-[10px] text-slate-400 mt-1">
              সার্ভারে LIVEKIT_URL কনফিগার করা নেই অথবা ব্রাউজার মিডিয়া ডিভাইস সাপোর্ট করছে না।
            </div>
          </div>
        )}
      </div>
    );
  }

  // Handle user toggle mic
  const handleToggleClick = async () => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) return; // 300ms debounce
    lastClickRef.current = now;

    // Mobile audio unlock best effort
    try {
      if (pubRoom) await pubRoom.startAudio();
      if (mafRoom) await mafRoom.startAudio();
      setAudioPlaybackBlocked(false);
    } catch {
      // Audio unlock best effort
    }

    toggleMic();
  };

  // Audio unlock banner click
  const handleUnlockAudio = async () => {
    try {
      if (pubRoom) await pubRoom.startAudio();
      if (mafRoom) await mafRoom.startAudio();
      setAudioPlaybackBlocked(false);
    } catch {
      // Best effort
    }
  };

  const handleRetry = () => {
    retryConnection();
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Autoplay blocked banner / button */}
      {audioPlaybackBlocked && (
        <button
          type="button"
          onClick={handleUnlockAudio}
          className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition flex items-center gap-1 animate-pulse"
          title="ব্রাউজার অডিও চালু করতে ক্লিক করুন"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">অডিও চালু করুন</span>
          <span className="sm:hidden">অডিও</span>
        </button>
      )}

      {/* Voice Status Chip */}
      {voiceStatus === 'connecting' && (
        <span className="text-[11px] text-slate-400 hidden sm:inline">কানেক্ট হচ্ছে...</span>
      )}
      {voiceStatus === 'reconnecting' && (
        <span className="text-[11px] text-amber-400 animate-pulse hidden sm:inline">
          পুনঃসংযোগ...
        </span>
      )}
      {voiceStatus === 'failed' && (
        <button
          type="button"
          onClick={handleRetry}
          className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
          title="পুনরায় ভয়েস সংযোগ করার চেষ্টা করুন"
        >
          <RefreshCw className="w-3 h-3" />
          <span>রিট্রাই</span>
        </button>
      )}

      {/* Main Mic Button */}
      <button
        type="button"
        onClick={handleToggleClick}
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

      {/* Diagnostic Overlay (?voicedebug=1) */}
      {isDebugMode && (
        <>
          <button
            type="button"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="p-1 rounded bg-indigo-900/60 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs transition"
            title="ভয়েস ডিবাগ টগল"
          >
            <Bug className="w-3.5 h-3.5" />
          </button>
          {showDebugPanel && (
            <div className="absolute right-0 top-10 w-64 p-3 bg-slate-950/95 border border-indigo-500/50 rounded-lg shadow-2xl text-[11px] text-slate-300 font-mono z-50 backdrop-blur-sm">
              <div className="font-bold text-indigo-400 mb-1 border-b border-indigo-500/30 pb-1 flex justify-between items-center">
                <span>ভয়েস ডায়াগনস্টিক (?voicedebug=1)</span>
                <span className="text-[10px] text-slate-400">#{retryCount}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1">
                <span className="text-slate-400">Status:</span>
                <span
                  className={
                    voiceStatus === 'connected'
                      ? 'text-emerald-400'
                      : voiceStatus === 'failed'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                  }
                >
                  {voiceStatus}
                </span>

                <span className="text-slate-400">Public Room:</span>
                <span>{pubRoom?.state || 'none'}</span>

                <span className="text-slate-400">Mafia Room:</span>
                <span>{mafRoom?.state || 'none'}</span>

                <span className="text-slate-400">Mic Intent:</span>
                <span className={micEnabled ? 'text-emerald-400' : 'text-slate-500'}>
                  {micEnabled ? 'ENABLED' : 'MUTED'}
                </span>

                <span className="text-slate-400">Can Speak:</span>
                <span>{canSpeakNow ? 'YES' : 'NO'}</span>

                <span className="text-slate-400">Audio Unlock:</span>
                <span className={audioPlaybackBlocked ? 'text-rose-400' : 'text-emerald-400'}>
                  {audioPlaybackBlocked ? 'BLOCKED' : 'OK'}
                </span>

                <span className="text-slate-400">Speaking:</span>
                <span className={isSpeaking ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {isSpeaking ? 'YES' : 'NO'}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
