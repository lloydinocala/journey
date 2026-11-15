# Home Comfort Connect (customer app)

One app for the customers of every Journey company. It opens the customer portal
(https://portal.journey-hvac.app/portal); after a customer signs in, the app shows
**their own** HVAC company's name (and logo/color if the company has set them).

- Package name: `com.ventexiq.homecomfort` (separate from the field app, `com.ventexiq.journey`)
- Permissions: Internet only — no location, contacts, camera, microphone or call log
- In-app account deletion: Edit Personal Info → Delete my account
- Reviewer login: `app.review@journey-hvac.app` + password (a customer of the demo company only)

## Build the Play Store bundle (Android Studio)
1. In a terminal in this `customer-app` folder: `npm install` then `npx cap sync android`
2. Android Studio → File → Open → `customer-app/android`
3. Build → Generate Signed App Bundle → Android App Bundle → **Create new** key store
   (keep the .jks file and its passwords somewhere safe — it is this app's own upload key)
4. Upload `app/release/app-release.aab` in Play Console under the Home Comfort Connect app

Web changes ship through the normal Journey deploy — no app update needed for those.
