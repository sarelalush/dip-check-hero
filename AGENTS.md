# Project Instructions

- Do not run tests of any kind for this project unless the user explicitly revokes this instruction.
- Do not send test, diagnostic, synthetic, batch, stress, or verification requests to Gemini or any other paid external service.
- Do not perform trial scans or production API calls for validation.
- Code changes may be inspected statically, but do not execute test suites, test scripts, builds used as tests, or live verification calls.

## Hebrew UI

- The app is Hebrew-first. Hebrew text, controls, and navigation must follow a right-to-left layout.
- Align compact horizontal button groups to the right and place their first option at the right edge. A reversed item order alone does not align a horizontal scroll container.
- Follow the existing explicit RTL styles; enabling global RTL without adapting existing reversed rows can mirror them twice.
