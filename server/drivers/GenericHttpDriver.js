function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (values[key] === undefined || values[key] === null) {
      return "";
    }
    return encodeURIComponent(String(values[key]));
  });
}

export class GenericHttpDriver {
  async sendCommand(camera, command) {
    const templates = camera.driverConfig?.templates || {};
    const template = templates[command.type];
    if (!template) {
      throw new Error(`Template not configured for command: ${command.type}`);
    }

    const url = fillTemplate(template, {
      host: camera.host,
      username: camera.username,
      password: camera.password,
      speed: command.speed ?? 1
    });

    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Camera responded with ${response.status}`);
    }

    return {
      ok: true,
      message: `Command ${command.type} sent to ${camera.name}`,
      url
    };
  }
}
