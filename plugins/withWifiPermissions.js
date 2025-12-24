const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

const withWifiPermissions = (config) => {
  // Android permissions
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Add permissions
    if (!androidManifest["uses-permission"]) {
      androidManifest["uses-permission"] = [];
    }

    const permissions = [
      "android.permission.ACCESS_WIFI_STATE",
      "android. permission.CHANGE_WIFI_STATE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ];

    permissions.forEach((permission) => {
      if (
        !androidManifest["uses-permission"].find(
          (p) => p.$["android:name"] === permission
        )
      ) {
        androidManifest["uses-permission"].push({
          $: { "android:name": permission },
        });
      }
    });

    return config;
  });

  // iOS permissions
  config = withInfoPlist(config, (config) => {
    config.modResults.NSLocationWhenInUseUsageDescription =
      "We need location access to scan for WiFi networks for device setup.";
    config.modResults.NSLocationAlwaysAndWhenInUseUsageDescription =
      "We need location access to scan for WiFi networks for device setup.";

    return config;
  });

  return config;
};

module.exports = withWifiPermissions;
