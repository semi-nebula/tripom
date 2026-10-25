# PomoHarbor (tripom)

PomoHarbor — real-time multi-timer, Pomodoro, schedule (with VIT timetable
import and AI CSV import/export), study tracking, journal, todos, chat,
groups. Live site: https://pomoharbor.vercel.app

## Schedule from an AI chat (CSV)

In the Schedule tab, tap **🤖 AI CSV**. Copy the ready-made prompt into
Gemini / ChatGPT / any AI chat, describe your plan in plain words, then
import the `schedule.csv` it replies with (upload the file, or just paste
the text — a whole chat reply works). Each row becomes a normal slot you
can tap to edit or delete. To change your schedule later, use *Copy
prompt + my schedule*: your current timetable goes to the AI as CSV, you
describe the changes, and the updated CSV re-imports in "Replace my
previous CSV import" mode. Your schedule can also be exported as CSV.

Canonical format (see `schedule.example.csv`):

```csv
day,start,end,title,color,remind,timer
Mon,09:00,16:00,College,indigo,yes,no
```

`day` is `Mon`–`Sun` (one row per day), times are 24-hour `HH:MM`,
`color` is one of `indigo emerald amber rose sky violet slate`, and
`remind`/`timer` are `yes`/`no` (timer = also create a countdown timer).
The importer is deliberately forgiving about real AI output: full day
names, `Mon-Fri`, 12-hour times, a single `09:00-10:00` column, durations,
`;`/tab delimiters, markdown tables, and header aliases all parse.

The app is a single-file PWA (`index.html` + `todo.html`) with Firebase cloud
sync. The same file also powers the Android app via Capacitor.

## Android app (APK + source)

The Android app is a Capacitor wrapper around the **same** `index.html`, so
every sync path behaves exactly like the website (Firebase rooms, VIT live
sync, journal, todos, D-Days). The native layer only *adds*:

- Real OS notifications that fire **even with the app closed**: class
  reminders (exact start), countdown finish alarms, Pomodoro phase alerts,
  D-Day D-0/D-1/D-3, chat/friend notifications
- Vibration on alarms, dark status bar, Android back-button handling
  (todo → modals → background), external links in system browser
- Exact-alarm permission flow (Android 12+) for on-the-minute alerts

Source: `android/` (standard Capacitor project, Java) + the web sources at
the repo root. `www/` and `android/app/src/main/assets/public/` are generated
by `npm run cap:sync` but committed so Android Studio builds work directly.

### Build the APK (cloud, recommended)

Pushing to GitHub runs `.github/workflows/android-apk.yml`, which builds
`app-debug.apk` and uploads it as an artifact. Pushing a tag like `apk-v1.6.0`
additionally publishes it as a GitHub Release.

### Build locally

Requirements: Node 22+, JDK 21, Android SDK.

```sh
npm ci
npm run cap:sync        # copy web app into the Android project
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Or open `android/` in Android Studio and press Run.

### Notes / limitations

- Notifications need the in-app Settings → Desktop Notifications → Enable
  (same toggle as the website). Closed-app alarms work after that.
- After a phone reboot, open the app once — Android clears scheduled alarms
  on reboot and the app re-arms them on launch.
- Debug APKs are signed with a debug key (fine for personal installs; a
  Play release would need a release keystore + `USE_EXACT_ALARM` review).
