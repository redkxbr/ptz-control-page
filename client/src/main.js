import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "./styles.css";

const app = document.getElementById("app");
const toastContainer = document.getElementById("toastContainer");

const state = {
  cameras: [],
  scenes: {},
  selectedCameraId: null,
  selectedSceneId: null
};

const commandTypes = [
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "zoom_in",
  "zoom_out",
  "focus_in",
  "focus_out",
  "stop"
];

function saveCache() {
  localStorage.setItem("multicam-ptz-cache", JSON.stringify(state));
}

function loadCache() {
  const cached = localStorage.getItem("multicam-ptz-cache");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      Object.assign(state, parsed);
    } catch (error) {
      console.warn("Invalid cache", error);
    }
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Erro ao comunicar com o servidor");
  }
  if (response.status === 204) return null;
  return response.json();
}

function showToast(message, variant = "success") {
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-bg-${variant} border-0`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  toastContainer.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 2500 });
  bsToast.show();
  toast.addEventListener("hidden.bs.toast", () => toast.remove());
}

function getSelectedCamera() {
  return state.cameras.find((camera) => camera.id === state.selectedCameraId);
}

function getScenes(cameraId) {
  return state.scenes[cameraId] || [];
}

function setSelectedCamera(cameraId) {
  state.selectedCameraId = cameraId;
  state.selectedSceneId = null;
  render();
}

function setSelectedScene(sceneId) {
  state.selectedSceneId = sceneId;
  render();
}

async function refreshCameras() {
  const cameras = await api("/api/cameras");
  state.cameras = cameras;
  if (!state.selectedCameraId && cameras.length) {
    state.selectedCameraId = cameras[0].id;
  }
  await refreshScenes();
}

async function refreshScenes() {
  const camera = getSelectedCamera();
  if (!camera) {
    state.scenes = {};
    return;
  }
  const scenes = await api(`/api/cameras/${camera.id}/scenes`);
  state.scenes[camera.id] = scenes;
}

function renderCameraList() {
  return `
    <div class="card bg-secondary h-100">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Câmeras</span>
        <button class="btn btn-sm btn-light" id="addCameraBtn">+ Adicionar</button>
      </div>
      <div class="list-group list-group-flush">
        ${state.cameras
          .map((camera) => {
            const isSelected = camera.id === state.selectedCameraId;
            return `
              <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                isSelected ? "active" : ""
              }" data-camera-id="${camera.id}">
                <div>
                  <div class="fw-bold">${camera.name}</div>
                  <small class="text-${camera.status === "online" ? "success" : "warning"}">
                    ${camera.status === "online" ? "Online" : "Offline"}
                  </small>
                </div>
                <span class="badge text-bg-dark">${camera.driver}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderControls() {
  const camera = getSelectedCamera();
  if (!camera) {
    return `<div class="card bg-secondary h-100"><div class="card-body">Nenhuma câmera selecionada.</div></div>`;
  }

  return `
    <div class="card bg-secondary h-100">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <span>Controles PTZ</span>
          <span class="badge text-bg-dark">${camera.name}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="d-grid gap-2">
          <div class="ptz-grid">
            <button class="btn btn-outline-light ptz-btn" data-command="tilt_up">▲</button>
            <button class="btn btn-outline-light ptz-btn" data-command="zoom_in">+</button>
            <button class="btn btn-outline-light ptz-btn" data-command="focus_in">F+</button>
            <button class="btn btn-outline-light ptz-btn" data-command="pan_left">◀</button>
            <button class="btn btn-danger ptz-stop" data-command="stop">■</button>
            <button class="btn btn-outline-light ptz-btn" data-command="pan_right">▶</button>
            <button class="btn btn-outline-light ptz-btn" data-command="tilt_down">▼</button>
            <button class="btn btn-outline-light ptz-btn" data-command="zoom_out">−</button>
            <button class="btn btn-outline-light ptz-btn" data-command="focus_out">F−</button>
          </div>
        </div>
        <hr />
        <div class="mb-3">
          <label class="form-label">Velocidade Pan/Tilt</label>
          <input type="range" class="form-range" min="1" max="10" value="5" id="speedPanTilt" />
        </div>
        <div class="mb-3">
          <label class="form-label">Velocidade Zoom</label>
          <input type="range" class="form-range" min="1" max="10" value="5" id="speedZoom" />
        </div>
        <div class="mb-3">
          <label class="form-label">Velocidade Focus</label>
          <input type="range" class="form-range" min="1" max="10" value="5" id="speedFocus" />
        </div>
        <button class="btn btn-light w-100" id="saveSceneBtn">Salvar cena atual</button>
      </div>
    </div>
  `;
}

function renderScenes() {
  const camera = getSelectedCamera();
  if (!camera) {
    return `<div class="card bg-secondary h-100"><div class="card-body">Nenhuma câmera selecionada.</div></div>`;
  }
  const scenes = getScenes(camera.id);

  return `
    <div class="card bg-secondary h-100">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Cenas</span>
        <button class="btn btn-sm btn-light" id="createSceneBtn">Criar cena</button>
      </div>
      <div class="list-group list-group-flush">
        ${scenes
          .map((scene) => {
            const isSelected = scene.id === state.selectedSceneId;
            return `
              <div class="list-group-item list-group-item-action ${
                isSelected ? "active" : ""
              }" data-scene-id="${scene.id}">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="fw-bold">${scene.name}</div>
                    <small>${new Date(scene.updatedAt).toLocaleString()}</small>
                  </div>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-light" data-action="apply" data-scene-id="${scene.id}">Aplicar</button>
                    <button class="btn btn-outline-light" data-action="edit" data-scene-id="${scene.id}">Editar</button>
                    <button class="btn btn-outline-danger" data-action="delete" data-scene-id="${scene.id}">Apagar</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderModals() {
  return `
    <div class="modal fade" id="cameraModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <form class="modal-content bg-dark text-light" id="cameraForm">
          <div class="modal-header">
            <h5 class="modal-title">Adicionar câmera</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Nome</label>
                <input type="text" class="form-control" name="name" required />
              </div>
              <div class="col-md-6">
                <label class="form-label">Driver</label>
                <select class="form-select" name="driver">
                  <option value="mock">MockDriver</option>
                  <option value="generic_http">GenericHttpDriver</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">IP/Host</label>
                <input type="text" class="form-control" name="host" placeholder="http://192.168.0.10" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Usuário</label>
                <input type="text" class="form-control" name="username" />
              </div>
              <div class="col-md-6">
                <label class="form-label">Senha</label>
                <input type="password" class="form-control" name="password" />
              </div>
            </div>
            <hr />
            <div id="templateFields" class="d-none">
              <p class="small text-info">Configure os templates de URL (ex.: http://{{host}}/cgi-bin/ptz?move=left&speed={{speed}})</p>
              <div class="row g-3">
                ${commandTypes
                  .map((type) => {
                    return `
                      <div class="col-md-6">
                        <label class="form-label">${type}</label>
                        <input type="text" class="form-control" name="template_${type}" />
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-light">Salvar</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modal fade" id="sceneModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <form class="modal-content bg-dark text-light" id="sceneForm">
          <div class="modal-header">
            <h5 class="modal-title">Salvar cena</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Nome da cena</label>
              <input type="text" class="form-control" name="sceneName" required />
            </div>
            <p class="small text-info">Preencha direções e velocidades se o driver não fornecer leitura real.</p>
            ${["pan", "tilt", "zoom", "focus"]
              .map((axis) => {
                const directionOptions =
                  axis === "pan"
                    ? "<option value=\"left\">Esquerda</option><option value=\"right\">Direita</option>"
                    : axis === "tilt"
                    ? "<option value=\"up\">Cima</option><option value=\"down\">Baixo</option>"
                    : "<option value=\"in\">In</option><option value=\"out\">Out</option>";
                return `
                  <div class="row g-2 align-items-end mb-2">
                    <div class="col-4">
                      <label class="form-label text-capitalize">${axis}</label>
                      <select class="form-select" name="${axis}_direction">
                        <option value="">Não usar</option>
                        ${directionOptions}
                      </select>
                    </div>
                    <div class="col-8">
                      <label class="form-label">Velocidade</label>
                      <input type="range" min="1" max="10" value="5" class="form-range" name="${axis}_speed" />
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-light">Salvar cena</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function render() {
  app.innerHTML = `
    <div class="row g-3 app-layout">
      <div class="col-12 col-xl-3">${renderCameraList()}</div>
      <div class="col-12 col-xl-5">${renderControls()}</div>
      <div class="col-12 col-xl-4">${renderScenes()}</div>
    </div>
    ${renderModals()}
  `;

  attachEvents();
  saveCache();
}

function attachEvents() {
  document.querySelectorAll("[data-camera-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedCamera(btn.dataset.cameraId);
      refreshScenes().then(render);
    });
  });

  document.querySelectorAll("[data-scene-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedScene(btn.dataset.sceneId);
    });
  });

  const addCameraBtn = document.getElementById("addCameraBtn");
  if (addCameraBtn) {
    addCameraBtn.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("cameraModal"));
      modal.show();
    });
  }

  const saveSceneBtn = document.getElementById("saveSceneBtn");
  if (saveSceneBtn) {
    saveSceneBtn.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("sceneModal"));
      modal.show();
    });
  }

  const createSceneBtn = document.getElementById("createSceneBtn");
  if (createSceneBtn) {
    createSceneBtn.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("sceneModal"));
      modal.show();
    });
  }

  const cameraForm = document.getElementById("cameraForm");
  if (cameraForm) {
    const driverSelect = cameraForm.querySelector("select[name='driver']");
    const templateFields = cameraForm.querySelector("#templateFields");
    driverSelect.addEventListener("change", () => {
      templateFields.classList.toggle("d-none", driverSelect.value !== "generic_http");
    });

    cameraForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(cameraForm);
      const driver = formData.get("driver");
      const templates = {};
      commandTypes.forEach((type) => {
        const value = formData.get(`template_${type}`);
        if (value) templates[type] = value;
      });

      const payload = {
        name: formData.get("name"),
        driver,
        host: formData.get("host"),
        username: formData.get("username"),
        password: formData.get("password"),
        driverConfig: driver === "generic_http" ? { templates } : {}
      };

      try {
        await api("/api/cameras", { method: "POST", body: payload });
        await refreshCameras();
        render();
        bootstrap.Modal.getInstance(document.getElementById("cameraModal")).hide();
        cameraForm.reset();
        showToast("Câmera adicionada!", "success");
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  }

  const sceneForm = document.getElementById("sceneForm");
  if (sceneForm) {
    sceneForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const camera = getSelectedCamera();
      if (!camera) return;
      const formData = new FormData(sceneForm);
      const stateData = {};
      ["pan", "tilt", "zoom", "focus"].forEach((axis) => {
        const direction = formData.get(`${axis}_direction`);
        if (direction) {
          stateData[axis] = {
            direction,
            speed: Number(formData.get(`${axis}_speed`) || 5)
          };
        }
      });

      const payload = {
        name: formData.get("sceneName"),
        state: stateData
      };

      try {
        await api(`/api/cameras/${camera.id}/scenes`, { method: "POST", body: payload });
        await refreshScenes();
        render();
        bootstrap.Modal.getInstance(document.getElementById("sceneModal")).hide();
        sceneForm.reset();
        showToast("Cena salva!", "success");
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  }

  document.querySelectorAll("[data-action='apply']").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const camera = getSelectedCamera();
      if (!camera) return;
      try {
        await api(`/api/cameras/${camera.id}/scenes/${btn.dataset.sceneId}/apply`, {
          method: "POST"
        });
        showToast("Cena aplicada!", "success");
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  });

  document.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const camera = getSelectedCamera();
      const scenes = getScenes(camera.id);
      const scene = scenes.find((item) => item.id === btn.dataset.sceneId);
      if (!scene) return;
      const newName = window.prompt("Novo nome da cena", scene.name);
      if (!newName) return;
      try {
        await api(`/api/cameras/${camera.id}/scenes/${scene.id}`, {
          method: "PUT",
          body: { name: newName }
        });
        await refreshScenes();
        render();
        showToast("Cena atualizada!", "success");
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  });

  document.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const camera = getSelectedCamera();
      if (!camera) return;
      if (!window.confirm("Deseja apagar esta cena?")) return;
      try {
        await api(`/api/cameras/${camera.id}/scenes/${btn.dataset.sceneId}`, {
          method: "DELETE"
        });
        await refreshScenes();
        render();
        showToast("Cena removida.", "success");
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  });

  document.querySelectorAll(".ptz-btn").forEach((btn) => {
    const command = btn.dataset.command;
    const startCommand = async () => {
      const camera = getSelectedCamera();
      if (!camera) return;
      const speed = getSpeedForCommand(command);
      try {
        await api(`/api/cameras/${camera.id}/command`, {
          method: "POST",
          body: { type: command, speed }
        });
      } catch (error) {
        showToast(error.message, "danger");
      }
    };

    const stopCommand = async () => {
      const camera = getSelectedCamera();
      if (!camera) return;
      try {
        await api(`/api/cameras/${camera.id}/command`, {
          method: "POST",
          body: { type: "stop" }
        });
      } catch (error) {
        showToast(error.message, "danger");
      }
    };

    btn.addEventListener("mousedown", startCommand);
    btn.addEventListener("touchstart", startCommand, { passive: true });
    btn.addEventListener("mouseup", stopCommand);
    btn.addEventListener("mouseleave", stopCommand);
    btn.addEventListener("touchend", stopCommand);
  });

  const stopBtn = document.querySelector(".ptz-stop");
  if (stopBtn) {
    stopBtn.addEventListener("click", async () => {
      const camera = getSelectedCamera();
      if (!camera) return;
      try {
        await api(`/api/cameras/${camera.id}/command`, {
          method: "POST",
          body: { type: "stop" }
        });
        showToast("Stop enviado.", "success");
      } catch (error) {
        showToast(error.message, "danger");
      }
    });
  }
}

function getSpeedForCommand(command) {
  if (command.startsWith("pan") || command.startsWith("tilt")) {
    return Number(document.getElementById("speedPanTilt")?.value || 5);
  }
  if (command.startsWith("zoom")) {
    return Number(document.getElementById("speedZoom")?.value || 5);
  }
  if (command.startsWith("focus")) {
    return Number(document.getElementById("speedFocus")?.value || 5);
  }
  return 5;
}

async function init() {
  loadCache();
  render();
  try {
    await refreshCameras();
    render();
  } catch (error) {
    showToast("Erro ao carregar dados do servidor. Usando cache local.", "warning");
  }
}

init();
