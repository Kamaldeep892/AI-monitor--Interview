// Global MediaStream Registry to guarantee 100% hardware release (Webcam, Mic, Screen Share) when interview ends
let activeScreenStream = null;
let activeCameraStream = null;
const registeredStreams = new Set();

export const registerMediaStream = (stream) => {
  if (stream) registeredStreams.add(stream);
};

export const setGlobalScreenStream = (stream) => {
  if (stream) registeredStreams.add(stream);
  activeScreenStream = stream;
};

export const getGlobalScreenStream = () => activeScreenStream;

export const setGlobalCameraStream = (stream) => {
  if (stream) registeredStreams.add(stream);
  activeCameraStream = stream;
};

export const getGlobalCameraStream = () => activeCameraStream;

export const stopGlobalScreenStream = () => {
  if (activeScreenStream) {
    activeScreenStream.getTracks().forEach((track) => {
      try {
        track.stop();
        track.enabled = false;
      } catch {}
    });
    activeScreenStream = null;
  }
};

export const stopAllInterviewMediaStreams = () => {
  stopGlobalScreenStream();
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach((track) => {
      try {
        track.stop();
        track.enabled = false;
      } catch {}
    });
    activeCameraStream = null;
  }
  registeredStreams.forEach((stream) => {
    try {
      stream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
    } catch {}
  });
  registeredStreams.clear();
};
