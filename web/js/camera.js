/* Camera access with getUserMedia. Asks for the back camera on phones; on a PC it gets the webcam.
   The page must be served from localhost or HTTPS, or the browser blocks the camera. */

export async function openCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser cannot open a camera here. Open the app from http://127.0.0.1 or an HTTPS address.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
  });
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings ? track.getSettings() : {};
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return {
    label: track.label || 'Camera',
    /* A webcam faces the user, so the view is mirrored like a mirror. A back camera is not. */
    mirror: settings.facingMode !== 'environment',
    hasTorch: !!caps.torch,
    async setTorch(on) {
      if (!caps.torch) return false;
      try { await track.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch (e) { return false; }
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  };
}
