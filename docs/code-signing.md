<!-- path: docs/code-signing.md -->

# Code Signing & Release Verification Guide

This document describes the code-signing infrastructure, certificate management, and security verification procedures required to build and distribute production releases of **Dev Log Viewer** on **Windows**, **macOS**, and **Linux**.

---

## 1. Overview of Platform Security Requirements

| Operating System | Security Gatekeeper | Without Valid Code Signing | Signed & Notarized Behavior |
| :--- | :--- | :--- | :--- |
| **Windows 11 / 10** | Microsoft Defender SmartScreen | "Windows protected your PC: Unknown publisher" (Blocked) | Clean launch, publisher identity displayed as *Chris Njihia* |
| **macOS (Apple Silicon & Intel)** | Apple Gatekeeper & Notary Service | "Dev Log Viewer cannot be opened because Apple cannot check it for malicious software" | Verified developer popup, one-click Open |
| **Linux (Debian / Ubuntu / Fedora)** | Package Managers & SHA256 Integrity | Untrusted package warning | GPG-verified repository and package signature |

---

## 2. Windows Authenticode Signing

### A. Certificate Selection
Since June 2023, the CA/Browser Forum mandates that all code-signing private keys (Standard OV and EV) must reside on FIPS 140-2 Level 2 or Common Criteria EAL 4+ hardware security modules (HSM) or certified cloud signing services.

Supported configurations:
1. **Azure Trusted Signing (Recommended for CI/CD)**:
   - Microsoft-managed cloud HSM service that integrates directly with GitHub Actions without physical USB dongles.
2. **Physical Hardware Token (YubiKey 5 FIPS / SafeNet eToken)**:
   - For local release builds signed by Chris Njihia on a developer workstation.

### B. Manual Local Signing with `signtool.exe` (**MANUAL STEP**)
When signing built executables and installers locally on Windows:

```powershell
# Locate Windows SDK signtool.exe
$Signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"

# Dual-timestamped Authenticode signature for NSIS setup
& $Signtool sign /fd SHA256 `
  /tr "http://timestamp.digicert.com" `
  /td SHA256 `
  /n "Chris Njihia" `
  ".\target\release\bundle\nsis\Dev Log Viewer_0.1.0_x64-setup.exe"

# Dual-timestamped Authenticode signature for WiX MSI
& $Signtool sign /fd SHA256 `
  /tr "http://timestamp.digicert.com" `
  /td SHA256 `
  /n "Chris Njihia" `
  ".\target\release\bundle\msi\Dev Log Viewer_0.1.0_x64_en-US.msi"

# Verify signature integrity
& $Signtool verify /pa /v ".\target\release\bundle\nsis\Dev Log Viewer_0.1.0_x64-setup.exe"
```

### C. Building SmartScreen Reputation
- New code-signing certificates begin with **zero reputation** in Microsoft's telemetry database.
- SmartScreen warnings automatically disappear after a threshold of clean downloads and installations have been recorded by telemetry.
- EV certificates or Azure Trusted Signing provide immediate or accelerated reputation over standard OV certificates.

---

## 3. macOS Code Signing & Apple Notarization

### A. Prerequisites (**MANUAL STEP**)
1. Active Apple Developer Program enrollment ($99 USD/year).
2. **Developer ID Application** Certificate issued to Chris Njihia (format: `Developer ID Application: Chris Njihia (TEAM_ID)`).
3. App Store Connect API Key or an App-Specific Password generated at [appleid.apple.com](https://appleid.apple.com).

### B. Entitlements Configuration
Dev Log Viewer requires hardened runtime with permission to read user-selected local files. Create `src-tauri/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### C. Manual Notarization and Stapling Workflow (**MANUAL STEP**)

```bash
# 1. Sign the .app bundle with Hardened Runtime
codesign --deep --force --options runtime \
  --entitlements src-tauri/entitlements.mac.plist \
  --sign "Developer ID Application: Chris Njihia (TEAM_ID)" \
  "target/release/bundle/macos/Dev Log Viewer.app"

# 2. Package into DMG
# (Handled automatically by Tauri during 'pnpm tauri build')

# 3. Submit DMG to Apple Notary Service
xcrun notarytool submit "target/release/bundle/dmg/Dev Log Viewer_0.1.0_aarch64.dmg" \
  --apple-id "crnjihia@users.noreply.github.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "TEAM_ID" \
  --wait

# 4. Staple the notarization ticket to the DMG
xcrun stapler staple "target/release/bundle/dmg/Dev Log Viewer_0.1.0_aarch64.dmg"

# 5. Verify Gatekeeper compliance
spctl --assess --type open --context context:primary-signature --verbose \
  "target/release/bundle/dmg/Dev Log Viewer_0.1.0_aarch64.dmg"
```

---

## 4. Linux Package Signing & Checksums

### A. Generating SHA-256 Checksums
Always generate SHA-256 digests for Linux `.deb` and `.AppImage` distributions:

```bash
cd target/release/bundle
sha256sum deb/*.deb appimage/*.AppImage > SHA256SUMS.txt
```

### B. Signing with GPG (**MANUAL STEP**)
```bash
# Detached ASCII-armored signature for SHA256SUMS.txt
gpg --armor --detach-sign SHA256SUMS.txt

# Verify with Chris Njihia public key
gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
```

---

## 5. GitHub Actions Release Secrets Configuration (**MANUAL STEP**)

To enable automated release signing via `.github/workflows/release.yml`, configure the following repository secrets under **GitHub > Settings > Secrets and variables > Actions**:

| Secret Name | Description | Platform |
| :--- | :--- | :--- |
| `WINDOWS_CERTIFICATE_BASE64` | Base64-encoded `.pfx` code-signing certificate | Windows |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password protecting the `.pfx` file | Windows |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` Developer ID Application certificate | macOS |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting the `.p12` file | macOS |
| `APPLE_SIGNING_IDENTITY` | Full identity string (e.g. `Developer ID Application: Chris Njihia (...)`) | macOS |
| `APPLE_ID` | Apple ID email associated with developer account | macOS |
| `APPLE_PASSWORD` | App-specific password generated for `notarytool` | macOS |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID | macOS |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater minisign private key (if updater is enabled) | All |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password protecting Tauri minisign private key | All |

---

## 6. Release Verification Checklist (**MANUAL STEP**)

Before publishing a release draft to GitHub Releases:

- [ ] **Windows Clean Install**: Download `.msi` and `.exe` on a fresh Windows 11 machine; verify installer completes and file associations (`.log`, `.jsonl`) register in Explorer.
- [ ] **macOS Gatekeeper Check**: Download `.dmg` on macOS Sonoma/Sequoia; mount and drag to `/Applications`; verify no Gatekeeper warning appears.
- [ ] **Linux AppImage & Deb**: Test `.AppImage` on Ubuntu 22.04 and Fedora 40; test `sudo dpkg -i dev-log-viewer_*.deb`.
- [ ] **SLA Verification**: Open a 1 GB log file on each packaged binary and confirm First Paint occurs in < 1,000 ms.
- [ ] **Checksum Publication**: Confirm `SHA256SUMS.txt` is signed and attached to the release assets.

