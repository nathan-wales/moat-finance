Implement biometric app unlock for the iOS app using Apple LocalAuthentication and Keychain.

Goal:
Add optional Face ID / Touch ID / passcode-based local unlock to protect the app after the user has already authenticated normally. This should not replace backend auth. It should act as a local security gate before showing financial data.

Requirements:
1. Add `NSFaceIDUsageDescription` to the iOS Info.plist with copy like:
   "Use Face ID to securely unlock Moat and protect your financial data."

2. Create a `BiometricAuthService` using `LocalAuthentication.LAContext`.
   - Expose:
     - `canAuthenticate()`
     - `biometryType`
     - `authenticate(reason:) async throws -> Bool`
   - Prefer `.deviceOwnerAuthentication` for app unlock so Face ID/Touch ID can fall back to device passcode.
   - Handle common LAError cases: userCancel, userFallback, biometryNotAvailable, biometryNotEnrolled, biometryLockout, passcodeNotSet.

3. Add app lock state management.
   - Track whether biometric unlock is enabled.
   - Track whether the current app session is locked/unlocked.
   - Lock the app when it moves to background.
   - Add a configurable timeout foundation, even if v1 defaults to immediate or 1 minute.
   - Do not show financial screens while locked.

4. Add a locked screen.
   - Show Moat branding.
   - Message: "Moat is locked."
   - Button: "Unlock with Face ID" / "Unlock with Touch ID" / "Unlock"
   - Automatically attempt unlock once when the locked screen appears.
   - If the user cancels, stay on the locked screen and allow manual retry.

5. Add Settings > Security controls.
   - Toggle: "Require Face ID"
   - Options foundation for "Require after": immediately, 1 minute, 5 minutes, 15 minutes.
   - If enabling Face ID, immediately run authentication before saving the setting.
   - If disabling Face ID, require authentication first if currently enabled.

6. Store sensitive auth/session tokens in Keychain, not UserDefaults.
   - Audit current storage of auth/session tokens.
   - Move tokens to Keychain if they are currently in UserDefaults or insecure storage.
   - Store only non-sensitive preferences like `biometricUnlockEnabled` and lock timeout in UserDefaults.

7. Consider using Keychain access control for the refresh token.
   - Prefer `kSecAccessControlBiometryCurrentSet` or equivalent SecAccessControl flags for secrets that should become inaccessible if the enrolled Face ID user changes.
   - If this causes too much friction, document the tradeoff and use standard Keychain storage for v1.

8. Security behavior:
   - Logout must clear all biometric settings and Keychain tokens.
   - If biometric auth becomes unavailable, fall back to full login.
   - If Keychain access fails because biometric enrollment changed, clear local auth state and force login again.
   - Do not leak balances, transactions, or sensitive financial UI behind the lock screen.

9. App switcher privacy:
   - Add a privacy overlay when the app enters background so balances/transactions are hidden in the iOS app switcher.

10. Testing:
   - Add manual test notes for:
     - Face ID available and enrolled
     - Face ID unavailable
     - User cancels prompt
     - Biometry lockout
     - App background/foreground lock
     - Logout clears Keychain
     - Token expiry after successful biometric unlock
     - Simulator biometric enrolled/unenrolled states

Deliverables:
- BiometricAuthService
- Keychain storage helper or integration with existing secure storage
- AppLockState/AppLockProvider or equivalent
- Locked screen UI
- Settings > Security toggle
- App lifecycle lock behavior
- Privacy overlay for app switcher
- Notes on any token storage changes or security tradeoffs