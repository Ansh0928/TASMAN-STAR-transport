---
status: testing
phase: full-uat
source: manual extraction from codebase
started: 2026-03-04T10:00:00+10:00
updated: 2026-03-04T10:00:00+10:00
---

## Current Test

number: 1
name: Mobile App Cold Start
expected: |
  Kill any running Expo server. Run `npx expo start --clear` from apps/mobile.
  The Metro bundler starts without errors. Open the app in Expo Go.
  The app loads and shows the login screen (not a crash or white screen).
awaiting: user response

## Tests

### 1. Mobile App Cold Start
expected: Kill any running Expo server. Run `npx expo start --clear`. App loads in Expo Go and shows the login screen.
result: [pending]

### 2. Mobile Login (Admin)
expected: On the login screen, enter admin@tasmantransport.com.au / Admin123! and tap Sign In. You should be redirected to the Admin dashboard tab screen with stats cards.
result: [pending]

### 3. Mobile Customer Registration
expected: From login screen, tap "Sign Up". Fill in name, email, phone, password. Tap Register. Account creates and you land on the Customer bookings list (empty).
result: [pending]

### 4. Mobile Customer New Booking
expected: As a customer, tap "New Booking" or the + button. The booking form loads with route selector, address fields, date/time pickers, item type, dimensions, special instructions, and photo upload.
result: [pending]

### 5. Mobile Admin Bookings View
expected: Log in as admin. Navigate to Bookings tab. You see a list of all bookings (or empty state). Each booking shows booking number, status, customer name, route.
result: [pending]

### 6. Mobile Admin Assign Driver
expected: As admin, tap a pending booking. You see booking details and an option to assign a driver. Selecting a driver and confirming changes the status to "confirmed".
result: [pending]

### 7. Mobile Admin Create Driver
expected: As admin, go to Drivers tab. Tap "Add Driver" or similar. Fill in name, email, phone, password. Submit creates a new driver account. Driver appears in the list.
result: [pending]

### 8. Mobile Driver Jobs View
expected: Log in as a driver. Navigate to Jobs tab. You see a list of assigned jobs (confirmed bookings) or empty state.
result: [pending]

### 9. Mobile Driver Job Workflow
expected: As a driver, tap an assigned job. You see job details with a "Start Job" button. Tapping it progresses status to en_route. Subsequent steps: at_pickup → take photos → get signature → in_transit → at delivery → take photos → get signature → delivered.
result: [pending]

### 10. Mobile Customer Tracking
expected: As a customer with an in-transit booking, open the booking detail. A map appears showing the driver's live location (or a placeholder if no driver is active).
result: [pending]

### 11. Web Dashboard Login
expected: Open https://tasman-transport-admin.vercel.app (or localhost:3001). You see a login page. Enter admin@tasmantransport.com.au / Admin123!. You're redirected to the dashboard with stats cards, recent bookings, and status distribution.
result: [pending]

### 12. Web Dashboard Bookings
expected: In the web dashboard, click Bookings in the sidebar. A table shows all bookings with filters (status, search). Clicking a booking opens a detail view with photos, signatures, and driver assignment.
result: [pending]

### 13. Web Dashboard Drivers
expected: Click Drivers in the sidebar. You see a list of drivers with status. There's a button to create a new driver account.
result: [pending]

### 14. Web Dashboard Pricing
expected: Click Pricing in the sidebar. You see pricing entries per route and item type. You can edit prices inline and save.
result: [pending]

### 15. Web Dashboard Live Tracking
expected: Click Tracking in the sidebar. A Google Maps view loads (may need API key configured). Shows active driver markers or empty map.
result: [pending]

## Summary

total: 15
passed: 0
issues: 0
pending: 15
skipped: 0

## Gaps

[none yet]
