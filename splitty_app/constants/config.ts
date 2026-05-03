// ─── API configuration ────────────────────────────────────────────────────────
//
// Change API_URL to point to whichever backend you want to test against.
//
//   iOS Simulator talking to your laptop:  "http://localhost:8000"
//   Android Emulator talking to your laptop: "http://10.0.2.2:8000"
//   Physical device on the same Wi-Fi:     "http://192.168.x.x:8000"
//                                            (use `ifconfig` to find your IP)
//
// export const API_URL = 'http://127.0.0.1:8000';
export const API_URL = 'http://192.168.0.44:8000';

// The user ID sent as `x-user-id` on every request.
// Change this to switch which account you're testing as.
export const DEV_USER_ID = 1;
