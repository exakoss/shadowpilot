export const VIDEO_ONLY_MEDIA_CONSTRAINTS = {
  audio: false,
  video: true,
} satisfies MediaStreamConstraints;

export function ensureVideoOnlyStream(stream: MediaStream) {
  for (const track of stream.getAudioTracks()) {
    track.stop();
    stream.removeTrack(track);
  }

  return stream;
}

export function createVideoOnlyMediaRecorder(stream: MediaStream) {
  return new MediaRecorder(ensureVideoOnlyStream(stream));
}
