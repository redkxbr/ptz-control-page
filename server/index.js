import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { readData, updateData, ensureDataFile } from "./storage.js";
import { MockDriver } from "./drivers/MockDriver.js";
import { GenericHttpDriver } from "./drivers/GenericHttpDriver.js";

const app = express();
const PORT = process.env.PORT || 3000;
const APPLY_DELAY_MS = Number(process.env.APPLY_DELAY_MS || 150);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const drivers = {
  mock: new MockDriver(),
  generic_http: new GenericHttpDriver()
};

function getDriver(camera) {
  const driver = drivers[camera.driver];
  if (!driver) {
    throw new Error(`Driver not found: ${camera.driver}`);
  }
  return driver;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use(morgan("dev"));
app.use(express.json());

app.get("/api/cameras", async (req, res) => {
  const data = await readData();
  res.json(data.cameras);
});

app.post("/api/cameras", async (req, res) => {
  const camera = req.body;
  if (!camera?.name || !camera?.driver) {
    return res.status(400).json({ error: "name and driver are required" });
  }

  const newCamera = {
    id: crypto.randomUUID(),
    name: camera.name,
    driver: camera.driver,
    host: camera.host || "",
    username: camera.username || "",
    password: camera.password || "",
    driverConfig: camera.driverConfig || {},
    status: "offline"
  };

  const data = await updateData((current) => {
    current.cameras.push(newCamera);
    if (!current.scenes[newCamera.id]) {
      current.scenes[newCamera.id] = [];
    }
    return current;
  });

  res.status(201).json(newCamera);
});

app.put("/api/cameras/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const data = await updateData((current) => {
    const camera = current.cameras.find((item) => item.id === id);
    if (!camera) {
      return current;
    }
    Object.assign(camera, updates, { id: camera.id });
    return current;
  });

  const camera = data.cameras.find((item) => item.id === id);
  if (!camera) {
    return res.status(404).json({ error: "Camera not found" });
  }

  res.json(camera);
});

app.delete("/api/cameras/:id", async (req, res) => {
  const { id } = req.params;

  const data = await updateData((current) => {
    current.cameras = current.cameras.filter((item) => item.id !== id);
    delete current.scenes[id];
    return current;
  });

  res.json({ ok: true });
});

app.post("/api/cameras/:id/command", async (req, res) => {
  const { id } = req.params;
  const command = req.body;

  const data = await readData();
  const camera = data.cameras.find((item) => item.id === id);
  if (!camera) {
    return res.status(404).json({ error: "Camera not found" });
  }

  try {
    const driver = getDriver(camera);
    const result = await driver.sendCommand(camera, command);
    await updateData((current) => {
      const target = current.cameras.find((item) => item.id === id);
      if (target) target.status = "online";
      return current;
    });
    res.json(result);
  } catch (error) {
    await updateData((current) => {
      const target = current.cameras.find((item) => item.id === id);
      if (target) target.status = "offline";
      return current;
    });
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/cameras/:id/scenes", async (req, res) => {
  const { id } = req.params;
  const data = await readData();
  res.json(data.scenes[id] || []);
});

app.post("/api/cameras/:id/scenes", async (req, res) => {
  const { id } = req.params;
  const { name, state } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Scene name is required" });
  }

  const scene = {
    id: crypto.randomUUID(),
    name,
    state: state || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await updateData((current) => {
    if (!current.scenes[id]) {
      current.scenes[id] = [];
    }
    current.scenes[id].push(scene);
    return current;
  });

  res.status(201).json(scene);
});

app.put("/api/cameras/:id/scenes/:sceneId", async (req, res) => {
  const { id, sceneId } = req.params;
  const { name, state } = req.body;

  const data = await updateData((current) => {
    const scenes = current.scenes[id] || [];
    const scene = scenes.find((item) => item.id === sceneId);
    if (!scene) {
      return current;
    }
    if (name) scene.name = name;
    if (state) scene.state = state;
    scene.updatedAt = new Date().toISOString();
    return current;
  });

  const scene = data.scenes[id]?.find((item) => item.id === sceneId);
  if (!scene) {
    return res.status(404).json({ error: "Scene not found" });
  }

  res.json(scene);
});

app.delete("/api/cameras/:id/scenes/:sceneId", async (req, res) => {
  const { id, sceneId } = req.params;
  await updateData((current) => {
    current.scenes[id] = (current.scenes[id] || []).filter(
      (scene) => scene.id !== sceneId
    );
    return current;
  });

  res.json({ ok: true });
});

function commandFromScene(key, value) {
  if (!value) return null;
  if (key === "pan") {
    return {
      type: value.direction === "right" ? "pan_right" : "pan_left",
      speed: value.speed ?? 1
    };
  }
  if (key === "tilt") {
    return {
      type: value.direction === "up" ? "tilt_up" : "tilt_down",
      speed: value.speed ?? 1
    };
  }
  if (key === "zoom") {
    return {
      type: value.direction === "in" ? "zoom_in" : "zoom_out",
      speed: value.speed ?? 1
    };
  }
  if (key === "focus") {
    return {
      type: value.direction === "in" ? "focus_in" : "focus_out",
      speed: value.speed ?? 1
    };
  }
  return null;
}

app.post("/api/cameras/:id/scenes/:sceneId/apply", async (req, res) => {
  const { id, sceneId } = req.params;
  const data = await readData();
  const camera = data.cameras.find((item) => item.id === id);
  if (!camera) {
    return res.status(404).json({ error: "Camera not found" });
  }
  const scene = data.scenes[id]?.find((item) => item.id === sceneId);
  if (!scene) {
    return res.status(404).json({ error: "Scene not found" });
  }

  try {
    const driver = getDriver(camera);
    const commands = [
      { type: "stop" },
      commandFromScene("pan", scene.state?.pan),
      commandFromScene("tilt", scene.state?.tilt),
      commandFromScene("zoom", scene.state?.zoom),
      commandFromScene("focus", scene.state?.focus)
    ].filter(Boolean);

    for (const command of commands) {
      await driver.sendCommand(camera, command);
      await delay(APPLY_DELAY_MS);
    }

    await updateData((current) => {
      const target = current.cameras.find((item) => item.id === id);
      if (target) target.status = "online";
      return current;
    });

    res.json({ ok: true, applied: commands.length });
  } catch (error) {
    await updateData((current) => {
      const target = current.cameras.find((item) => item.id === id);
      if (target) target.status = "offline";
      return current;
    });
    res.status(500).json({ error: error.message });
  }
});

const clientDist = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
