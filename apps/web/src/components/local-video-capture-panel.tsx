"use client";

import { useEffect, useRef, useState } from "react";

import {
  createVideoOnlyMediaRecorder,
  ensureVideoOnlyStream,
  VIDEO_ONLY_MEDIA_CONSTRAINTS,
} from "@/lib/video-only-recording";

import { PrivacyPill } from "./privacy-pill";
import { StatusPill } from "./status-pill";

export type LocalClipState = {
  blob: Blob;
  durationMillis?: number;
  mimeType: string;
  name: string;
  sizeLabel: string;
  source: "recorded" | "uploaded";
  url: string;
};

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

export function LocalVideoCapturePanel({
  onClipChange,
}: {
  onClipChange: (clip: LocalClipState | null) => void;
}) {
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [clip, setClip] = useState<LocalClipState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    onClipChange(clip);
  }, [clip, onClipChange]);

  useEffect(() => {
    return () => {
      if (clip) {
        URL.revokeObjectURL(clip.url);
      }

      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, [clip]);

  function clearClip() {
    if (clip) {
      URL.revokeObjectURL(clip.url);
    }
    setClip(null);
  }

  function stopStream() {
    if (!streamRef.current) {
      return;
    }

    for (const track of streamRef.current.getTracks()) {
      track.stop();
    }

    streamRef.current = null;

    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }
  }

  async function startRecording() {
    setError(null);
    setIsPreparing(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support local video recording.");
      }

      clearClip();
      const stream = ensureVideoOnlyStream(
        await navigator.mediaDevices.getUserMedia(VIDEO_ONLY_MEDIA_CONSTRAINTS),
      );
      streamRef.current = stream;
      chunksRef.current = [];

      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        await livePreviewRef.current.play().catch(() => undefined);
      }

      const recorder = createVideoOnlyMediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        const url = URL.createObjectURL(blob);
        setClip({
          blob,
          durationMillis: undefined,
          mimeType: recorder.mimeType || "video/webm",
          name: `shadowpilot-capture-${Date.now()}.webm`,
          sizeLabel: formatBytes(blob.size),
          source: "recorded",
          url,
        });
        setIsRecording(false);
        stopStream();
      };
      recorder.start();
      setIsRecording(true);
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : String(recordingError));
      stopStream();
    } finally {
      setIsPreparing(false);
    }
  }

  function stopRecording() {
    if (!recorderRef.current) {
      return;
    }

    recorderRef.current.stop();
    recorderRef.current = null;
  }

  function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    clearClip();
    const url = URL.createObjectURL(file);
    setClip({
      blob: file,
      durationMillis: undefined,
      mimeType: file.type || "video/mp4",
      name: file.name,
      sizeLabel: formatBytes(file.size),
      source: "uploaded",
      url,
    });
  }

  return (
    <article className="panel-muted rounded-[24px] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Local clip capture</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text)]">
            Record or upload a local clip
          </h3>
        </div>
        <StatusPill
          label={isRecording ? "Recording" : clip ? "Clip ready" : "Local only"}
          tone={isRecording ? "active" : clip ? "good" : "neutral"}
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        The pilot can keep the raw video local. Record a fresh clip or upload an existing file
        before staging the package.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white">
          {isRecording ? (
            <video
              ref={livePreviewRef}
              autoPlay
              muted
              playsInline
              className="aspect-video h-full w-full bg-[#e5e7eb] object-cover"
            />
          ) : clip ? (
            <video controls src={clip.url} className="aspect-video h-full w-full bg-[#e5e7eb] object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-[#f3f4f6] px-6 text-center text-sm leading-6 text-[var(--text-muted)]">
              Camera preview or uploaded clip will appear here.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-[20px] border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text)]">Capture privacy</p>
              <PrivacyPill scope="pilot" />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Raw video stays local in the browser for this capture flow. Only the compact
              submission metrics and pointer are meant to travel beyond the pilot workspace.
            </p>
          </div>

          <div className="rounded-[20px] border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Current clip</p>
            <p className="mt-2 text-sm text-[var(--text)]">
              {clip ? clip.name : "No local clip selected"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {clip
                ? `${clip.source === "recorded" ? "Recorded in browser" : "Uploaded locally"} • ${clip.sizeLabel}`
                : "Record a clip or upload a file to enable the package stage."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void startRecording();
              }}
              disabled={isRecording || isPreparing}
              className="rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPreparing ? "Preparing camera" : "Start recording"}
            </button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={!isRecording}
              className="rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stop recording
            </button>
            <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white">
              Upload local file
              <input type="file" accept="video/*" className="hidden" onChange={handleUploadChange} />
            </label>
            <button
              type="button"
              onClick={clearClip}
              disabled={!clip}
              className="rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--background-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear clip
            </button>
          </div>

          {error ? <p className="text-sm text-[var(--critical)]">{error}</p> : null}
        </div>
      </div>
    </article>
  );
}
