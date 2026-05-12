# Force-Stop Recovery

Android force-stop is a hard user/system override. After:

```sh
adb shell am force-stop com.libreascent.app
```

Android prevents LibreAscent services, receivers, alarms, and boot handlers from
running until the user manually launches the app again.

Expected behavior:

- While force-stopped, blocking cannot restart by itself.
- On next manual launch, startup recovery restarts the foreground service,
  re-syncs lightweight protection config, restores cached category domains, and
  restarts VPN when VPN permission is already prepared and schedule allows it.
