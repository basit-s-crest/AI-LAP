import { useState, useEffect, useRef, useCallback } from "react";
import type { TranscriptLine } from "@/types/sessionNote";

export function useLiveTranscription(
  speaker: 'member' | 'coach', 
  customStream?: MediaStream | null,
  onFinalTranscript?: (text: string) => void,
  sessionId?: string,
  transcriptionToken?: string,
  onLiveAnalysis?: (text: string) => void
) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupported = true; // Always true as supported by standard modern browsers

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const onLiveAnalysisRef = useRef(onLiveAnalysis);
  useEffect(() => {
    onLiveAnalysisRef.current = onLiveAnalysis;
  }, [onLiveAnalysis]);

  // Keep speaker in a ref in case it changes dynamically
  const speakerRef = useRef(speaker);
  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  // Keep isListeningRef updated in sync with isListening state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Keep customStream in a ref to prevent stale closures and avoid track-stopping bugs
  const customStreamRef = useRef(customStream);
  useEffect(() => {
    customStreamRef.current = customStream;
  }, [customStream]);

  const stopListening = useCallback(() => {
    if (!isListeningRef.current && !mediaRecorderRef.current) return;

    isListeningRef.current = false;
    setIsListening(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("[useLiveTranscription] Failed to stop MediaRecorder:", err);
      }
    }

    if (streamRef.current) {
      try {
        if (streamRef.current !== customStreamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.warn("[useLiveTranscription] Failed to stop MediaStream tracks:", err);
      }
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close();
        }
      } catch (err) {
        console.warn("[useLiveTranscription] Failed to close AudioContext:", err);
      }
      audioContextRef.current = null;
    }

    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          // Send an empty JSON or close frame to let Deepgram finish
          socketRef.current.close();
        }
      } catch (err) {
        console.warn("[useLiveTranscription] Failed to close Deepgram WebSocket:", err);
      }
    }

    mediaRecorderRef.current = null;
    streamRef.current = null;
    socketRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    if (isStartingRef.current) {
      console.log('[STT] startListening already in progress for:', speakerRef.current);
      return;
    }
    if (isListeningRef.current || (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording")) {
      console.log('[STT] Already listening or recording for speaker:', speakerRef.current);
      return;
    }
    isStartingRef.current = true;
    setError(null);
    stopListening(); // Clear any existing resources first

    try {
      console.log('[STT] Initializing STT proxy connection for speaker:', speakerRef.current);

      console.log('[STT DEBUG] customStreamRef.current exists:', !!customStreamRef.current);
      if (customStreamRef.current) {
        console.log('[STT DEBUG] customStreamRef.current properties:', {
          active: customStreamRef.current.active,
          id: customStreamRef.current.id,
          tracks: customStreamRef.current.getAudioTracks().map(t => ({
            id: t.id,
            kind: t.kind,
            readyState: t.readyState,
            enabled: t.enabled
          }))
        });
      }

      const stream = customStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 1. Log exact track/stream properties
      if (stream) {
        const tracks = stream.getAudioTracks();
        console.log("[DEBUG] useLiveTranscription stream/track properties:", {
          streamActive: stream.active,
          streamId: stream.id,
          audioTracksCount: tracks.length,
          tracks: tracks.map(t => ({
            kind: t.kind,
            readyState: t.readyState,
            enabled: t.enabled,
            id: t.id
          }))
        });
      }

      // 2. Test browser support for MediaRecorder formats
      console.log("[DEBUG] useLiveTranscription browser media support check:", {
        "audio/webm": typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported ? MediaRecorder.isTypeSupported("audio/webm") : "N/A",
        "audio/webm;codecs=opus": typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported ? MediaRecorder.isTypeSupported("audio/webm;codecs=opus") : "N/A",
        "audio/mp4": typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported ? MediaRecorder.isTypeSupported("audio/mp4") : "N/A"
      });

      let recordStream: MediaStream;

      if (customStreamRef.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            console.log('[STT DEBUG] Creating AudioContext to route customStream...');
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            
            if (audioCtx.state === "suspended") {
              await audioCtx.resume();
              console.log('[STT DEBUG] AudioContext resumed successfully. State:', audioCtx.state);
            }
            
            const sourceNode = audioCtx.createMediaStreamSource(stream);
            const destNode = audioCtx.createMediaStreamDestination();
            sourceNode.connect(destNode);
            
            recordStream = destNode.stream;
            console.log('[STT DEBUG] AudioContext routing configured successfully.');
          } else {
            recordStream = stream;
          }
        } catch (audioCtxErr) {
          console.warn('[STT] Failed to initialize AudioContext routing, falling back to raw stream:', audioCtxErr);
          recordStream = stream;
        }
      } else {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error("No active audio tracks found in the stream.");
        }

        // Filter out only tracks that have explicitly ended.
        // If all tracks are filtered, fall back to using the original audioTracks array.
        const activeTracks = audioTracks.filter(t => t.readyState !== 'ended');
        const tracksToUse = activeTracks.length > 0 ? activeTracks : audioTracks;

        // Wrap the tracks in a new MediaStream to bypass WebRTC metadata recording issues
        recordStream = new MediaStream(tracksToUse);
      }

      console.log('[STT DEBUG] recordStream properties:', {
        active: recordStream.active,
        id: recordStream.id,
        tracks: recordStream.getAudioTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled
        }))
      });

      // Create MediaRecorder (no mimeType option — let browser pick)
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(recordStream);
        mediaRecorderRef.current = mediaRecorder;
        console.log('[STT DEBUG] MediaRecorder created successfully. Initial state:', mediaRecorder.state);
      } catch (err: any) {
        console.error('[STT] MediaRecorder creation failed:', err);
        if (err.name === 'NotSupportedError') {
          setError("Audio format or browser configuration is not supported for recording.");
        } else {
          setError(`MediaRecorder initialization failed: ${err.message}`);
        }
        throw err;
      }

      // Point WebSocket connection to our Python STT WebSocket proxy
      const pythonBackendUrl = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || "http://localhost:8001";
      let wsUrl = pythonBackendUrl.replace(/^http/, 'ws') + '/v1/stt';
      if (transcriptionToken && sessionId) {
        wsUrl += `?token=${encodeURIComponent(transcriptionToken)}&sessionId=${encodeURIComponent(sessionId)}`;
      }
      
      console.log('[STT] Connecting to STT proxy at:', wsUrl);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('[STT] Deepgram WebSocket open for:', speakerRef.current);
        try {
          console.log('[STT DEBUG] socket.onopen - mediaRecorder state:', mediaRecorder.state);
          // Start MediaRecorder only AFTER the WebSocket is successfully open
          // to ensure the first WebM container header is successfully sent to Deepgram.
          if (mediaRecorder.state !== "recording") {
            console.log('[STT DEBUG] socket.onopen - Calling mediaRecorder.start(250)...');
            mediaRecorder.start(250);
            console.log('[STT DEBUG] socket.onopen - mediaRecorder.start call completed. state:', mediaRecorder.state);
          }
          setIsListening(true);
          isListeningRef.current = true;
        } catch (err: any) {
          console.error('[STT] Failed to start MediaRecorder on WebSocket open:', err);
          if (err.name === 'NotSupportedError') {
            setError("Audio recording configuration is not supported by this browser.");
          } else {
            setError(`Failed to start recording: ${err.message}`);
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data?.type === "live_analysis") {
            const analysisText = data.analysis;
            console.log('[STT] Received live analysis:', analysisText);
            if (onLiveAnalysisRef.current) {
              onLiveAnalysisRef.current(analysisText);
            }
            return;
          }

          const alt = data?.channel?.alternatives?.[0];
          if (!alt?.transcript?.trim()) return;
          const text = alt.transcript.trim();
          const isFinal = data.is_final === true || data.speech_final === true;
          const currentSpeaker = speakerRef.current;

          console.log('[STT] Received:', text, '| isFinal:', isFinal);

          if (isFinal) {
            setTranscript((prev) => [
              ...prev.filter((l) => l.isFinal),
              { speaker: currentSpeaker, text, timestamp: new Date().toISOString(), isFinal: true },
            ]);
            if (currentSpeaker === "member" && onFinalTranscriptRef.current) {
              onFinalTranscriptRef.current(text);
            }
          } else {
            setTranscript((prev) => [
              ...prev.filter((l) => l.isFinal),
              { speaker: currentSpeaker, text, timestamp: new Date().toISOString(), isFinal: false },
            ]);
          }
        } catch (err) {
          console.warn("[useLiveTranscription] Error parsing WebSocket message:", err);
        }
      };

      socket.onerror = (err) => {
        console.error('[STT] WebSocket error — check API key and network', err);
        setIsListening(false);
        isListeningRef.current = false;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
      };

      socket.onclose = () => {
        console.log('[STT] WebSocket closed for:', speakerRef.current);
        setIsListening(false);
        isListeningRef.current = false;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
      };

      mediaRecorder.ondataavailable = async (event) => {
        console.log('[STT DEBUG] ondataavailable fired. size:', event.data.size, 'socketExist:', !!socket, 'readyState:', socket?.readyState);
        if (event.data.size > 0 && socket && socket.readyState === 1) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            console.log('[STT DEBUG] Sending audio buffer of size:', arrayBuffer.byteLength);
            socket.send(arrayBuffer);
          } catch (err) {
            console.warn("[useLiveTranscription] Failed to send audio data chunk:", err);
          }
        }
      };
    } catch (err) {
      console.error("[useLiveTranscription] startListening failed:", err);
      stopListening();
      throw err;
    } finally {
      isStartingRef.current = false;
    }
  }, [stopListening, transcriptionToken, sessionId]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    error,
  };
}
