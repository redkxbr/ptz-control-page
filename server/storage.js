import fs from "fs/promises";
import path from "path";

const dataPath = path.resolve("..", "data", "data.json");

const defaultData = {
  cameras: [
    {
      id: "mock-1",
      name: "Mock Camera 1",
      driver: "mock",
      host: "mock://camera-1",
      username: "",
      password: "",
      driverConfig: {},
      status: "online"
    }
  ],
  scenes: {
    "mock-1": []
  }
};

export async function ensureDataFile() {
  try {
    await fs.access(dataPath);
  } catch (error) {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(defaultData, null, 2));
  }
}

export async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(dataPath, "utf-8");
  return JSON.parse(raw);
}

export async function writeData(data) {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

export async function updateData(mutator) {
  const data = await readData();
  const updated = await mutator(data);
  await writeData(updated);
  return updated;
}

export { dataPath };
