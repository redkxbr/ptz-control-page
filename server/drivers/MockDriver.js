const mockState = new Map();

function ensureState(cameraId) {
  if (!mockState.has(cameraId)) {
    mockState.set(cameraId, {
      pan: 0,
      tilt: 0,
      zoom: 0,
      focus: 0,
      lastCommand: null
    });
  }
  return mockState.get(cameraId);
}

export class MockDriver {
  async sendCommand(camera, command) {
    const state = ensureState(camera.id);
    const { type, speed = 1 } = command;
    state.lastCommand = { type, speed, at: new Date().toISOString() };

    if (type === "pan_left") state.pan -= speed;
    if (type === "pan_right") state.pan += speed;
    if (type === "tilt_up") state.tilt += speed;
    if (type === "tilt_down") state.tilt -= speed;
    if (type === "zoom_in") state.zoom += speed;
    if (type === "zoom_out") state.zoom -= speed;
    if (type === "focus_in") state.focus += speed;
    if (type === "focus_out") state.focus -= speed;

    return {
      ok: true,
      state,
      message: `Mock command ${type} applied with speed ${speed}.`
    };
  }
}
