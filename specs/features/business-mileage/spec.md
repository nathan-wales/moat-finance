# Business Mileage

Build a new **Business Mileage** feature in the existing iOS app.

Keep this feature intentionally simple. Do not add automatic trip detection in this version.

## Navigation

Add a new **Mileage** page directly under **Taxes** in the mobile app navigation.

At the top of the Mileage page, use a segmented control:

**Track | History**

Default to **Track**.

---

## Track tab

The purpose of this screen is to let a user manually record a business mileage trip.

### Initial state

Show:

* Current mileage: `0.0 mi`
* Elapsed time: `00:00:00`
* A large primary **Start** button

Add a short explanation:

> Track business mileage for tax purposes. Start tracking when your business trip begins.

### Active trip

When the user taps **Start**:

* Begin tracking the user's location using Core Location.
* Continue tracking when the app is backgrounded or the phone is locked.
* Record a sequence of GPS coordinates throughout the trip.
* Calculate mileage based on the full path traveled, NOT the straight-line distance between the start and end locations.
* Continuously update:

  * Total miles
  * Elapsed time
* Replace Start with:

  * **Pause**
  * **Stop**

Use `CLLocationManager` and configure location tracking appropriately for driving.

Use reasonable filtering so inaccurate GPS readings do not artificially inflate mileage. Ignore obviously stale or low-quality readings.

Persist the active trip locally as it is being recorded so a temporary app interruption does not immediately destroy the trip.

### Pause

When the user taps **Pause**:

* Stop adding distance.
* Stop active location tracking if appropriate.
* Pause the elapsed trip timer.
* Change the control to **Resume**.

When resumed:

* Begin a new route segment.
* Do NOT calculate distance between the final point before pausing and the first point after resuming.

Example:

* Drive 5 miles
* Pause
* Drive 20 personal miles
* Resume
* Drive 4 miles
* Stop

Recorded trip mileage should be **9 miles**.

### Stop

When the user taps **Stop**, show a simple completion screen.

Display:

* Total miles
* Total tracked duration
* Date
* Optional small route map

Ask:

**What was this trip for?**

Provide a single-line text field such as:

`Client meeting`

This is the trip's business purpose and should be required before saving.

Do NOT ask the user whether the trip was Business / Personal / Medical / Charity/etc. Starting the business mileage tracker already implies this is a business trip.

Actions:

* **Save Trip**
* **Discard**

---

## Route storage

We need to retain enough route information to:

1. Calculate mileage correctly.
2. Display the trip route on a map later.
3. Display many historical trip routes together on one map.

Store route points while recording.

When saving, create a compact representation suitable for syncing to the server. Prefer an encoded/simplified polyline rather than storing thousands of permanent server-side GPS rows if practical.

A saved trip should contain at minimum:

```swift
MileageTrip {
    id
    startedAt
    endedAt
    distanceMeters
    trackedDurationSeconds

    startLatitude
    startLongitude
    endLatitude
    endLongitude

    encodedPolyline

    businessPurpose

    createdAt
    updatedAt
}
```

If pause/resume requires multiple polylines or segments, model that cleanly so separate segments are never accidentally connected.

---

## History tab

Show historical business mileage trips.

At the top show the selected year and summary:

* Total business miles
* Estimated standard-mileage deduction

The deduction amount should be calculated based on the applicable IRS mileage rate for the date of each trip rather than assuming one hardcoded rate forever.

Below that, provide:

**List | Map**

### List

Each trip row should show:

* Date
* Business purpose
* Mileage
* Estimated deduction

Tapping a trip opens trip details with:

* Route map
* Mileage
* Duration
* Business purpose
* Start/end time
* Estimated deduction

Allow the business purpose to be edited.

### Map

Display all trips for the selected year on one map.

Important:

* Each trip should render as its own polyline.
* Never draw a line between separate trips.
* Never draw a line across a pause/resume gap.
* Fit the map viewport around the displayed routes.
* Tapping an individual route should surface the corresponding trip.

Support selecting the year.

---

## Sync

Saved trips should sync through the existing Moat cloud/backend architecture so the same mileage history can appear on the web app.

Handle offline use gracefully:

* Tracking must work without network connectivity.
* Saving should work locally.
* Sync once connectivity is restored.

Do not require network connectivity while a trip is actively being recorded.

---

## Permissions

Request location permissions only when necessary for this feature.

Provide clear copy explaining that location is used while the user is actively tracking a business mileage trip.

Configure the required iOS background location capability so a trip continues while:

* Moat is in the background
* The phone is locked

Do not implement passive 24/7 location monitoring.

---

## Design principles

Keep this extremely lightweight.

The primary workflow should feel like:

**Start → drive → Pause if necessary → Stop → enter purpose → Save**

Do not add:

* Automatic trip detection
* Business/personal classification
* Vehicle management
* Expense entry
* Receipts
* Complicated tax workflows
* Automatic location monitoring when the user has not started a trip

Reuse the app's existing design system, navigation patterns, typography, spacing, sheets, buttons, and map styling wherever possible.

Before implementation, inspect the existing architecture and reuse existing networking, persistence, authentication, loading, error, and sync patterns rather than creating parallel infrastructure.
