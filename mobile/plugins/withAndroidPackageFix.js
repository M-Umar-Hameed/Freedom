const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withAndroidPackageFix(config) {
  const pkg = config.android?.package;
  if (!pkg) return config;

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;

      const manifestPath = path.join(platformRoot, "app", "src", "main", "AndroidManifest.xml");
      let manifest = fs.readFileSync(manifestPath, "utf-8");
      if (!manifest.includes('package="')) {
        manifest = manifest.replace("<manifest", `<manifest package="${pkg}"`);
        fs.writeFileSync(manifestPath, manifest);
      }

      const settingsPath = path.join(platformRoot, "settings.gradle");
      let settings = fs.readFileSync(settingsPath, "utf-8");
      if (!settings.includes("// autolinking-package-fix")) {
        settings += `
// autolinking-package-fix
gradle.settingsEvaluated {
  def autolinkFile = new File(rootDir, "build/generated/autolinking/autolinking.json")
  if (autolinkFile.exists()) {
    def content = autolinkFile.text
    if (content.contains('"packageName":"com.libreascent"')) {
      autolinkFile.text = content.replace('"packageName":"com.libreascent"', '"packageName":"${pkg}"')
    }
    if (autolinkFile.text.contains('"packageName": "com.libreascent"')) {
      autolinkFile.text = autolinkFile.text.replace('"packageName": "com.libreascent"', '"packageName": "${pkg}"')
    }
  }
}
`;
        fs.writeFileSync(settingsPath, settings);
      }

      return config;
    },
  ]);
}

module.exports = withAndroidPackageFix;
