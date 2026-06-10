import { useState, useEffect, useRef, useCallback } from "react";
import type { TranscriptLine } from "@/types/sessionNote";

export function useLiveTranscription(
  speaker: 'member' | 'coach', 
  customStream?: MediaStream | null,
  onFinalTranscript?: (text: string) => void,
  sessionId?: string,
  transcriptionToken?: string
) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isListening, setIsListening] = useState(false);
  const isSupported = true; // Always true as supported by standard modern browsers

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // Keep speaker in a ref in case it changes dynamically
  const speakerRef = useRef(speaker);
  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  // Keep isListeningRef updated in sync with isListening state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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
        if (streamRef.current !== customStream) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.warn("[useLiveTranscription] Failed to stop MediaStream tracks:", err);
      }
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
    isStartingRef.current = true;
    stopListening(); // Clear any existing resources first

    try {
      console.log('[STT] Initializing STT proxy connection for speaker:', speakerRef.current);

      const stream = customStream || await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('[STT] Audio stream acquired for:', speakerRef.current);

      // Create MediaRecorder (no mimeType option — let browser pick)
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

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
          // Start MediaRecorder only AFTER the WebSocket is successfully open
          // to ensure the first WebM container header is successfully sent to Deepgram.
          mediaRecorder.start(250);
          setIsListening(true);
          isListeningRef.current = true;
        } catch (err) {
          console.error('[STT] Failed to start MediaRecorder on WebSocket open:', err);
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
        const socketState = socketRef.current ? socketRef.current.readyState : 'null';
        console.log('[STT] Audio chunk:', {
          size: event.data.size,
          type: event.data.type,
          socketState,
        });

        if (event.data.size > 0 && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          try {
            const arrayBuffer = await event.data.arrayBuffer();
            console.log('[STT] Sending audio chunk, size:', arrayBuffer.byteLength);
            socketRef.current.send(arrayBuffer);
          } catch (err) {
            console.warn("[useLiveTranscription] Failed to process/send audio data chunk:", err);
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
  }, [stopListening, customStream]);

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
  };
}
