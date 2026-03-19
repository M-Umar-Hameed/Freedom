const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const JVM_BLOCK = `
subprojects { sub ->
  sub.plugins.withId("kotlin-android") {
    sub.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
      kotlinOptions {
        jvmTarget = "17"
      }
    }
  }
  sub.plugins.withId("org.jetbrains.kotlin.android") {
    sub.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
      kotlinOptions {
        jvmTarget = "17"
      }
    }
  }
  sub.plugins.withId("com.android.library") {
    sub.android {
      compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
      }
    }
  }
}
`;

function withJvmTarget17(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const buildGradle = path.join(
        config.modRequest.platformProjectRoot,
        "build.gradle"
      );
      let contents = fs.readFileSync(buildGradle, "utf-8");
      if (!contents.includes("jvmTarget")) {
        contents += JVM_BLOCK;
        fs.writeFileSync(buildGradle, contents);
      }
      return config;
    },
  ]);
}

module.exports = withJvmTarget17;
