# TacoPKM - Full Manual Test Script V2 (Windows 11 - PowerShell)
# RUN THIS SCRIPT FROM THE TacoPKM PROJECT ROOT DIRECTORY (where Hardhat project resides)

Clear-Host
Write-Host "TacoPKM - Full Manual Test Script (V2)" -ForegroundColor Yellow
Write-Host "========================================"
Write-Host "This script guides through testing 'tpkm' commands."
Write-Host "Ensure 'tpkm' is globally linked from your TacoPKM-CLI project." -ForegroundColor Magenta
Write-Host "Ensure Ganache (fresh instance) and IPFS daemon are running." -ForegroundColor Magenta

# --- Configuration Variables ---
$ProjectRoot = (Get-Location).Path # Should be TacoPKM/
$TestLibsRoot = Join-Path $ProjectRoot "test_libs_for_tpkm_script" # Test libraries will be created here

# Variables to store runtime data
$OwnerAddress = ""
$UserBAddress = ""
$DeployedLocalhostContractAddress = ""
$SepoliaContractAddressUserProvided = ""
$SepoliaRPCUserProvided = ""

# Function to pause and wait for user
function Pause-WithMessage ($Message) {
    Write-Host "`n$Message" -ForegroundColor Cyan
    Read-Host "Press Enter to continue..."
}

# Function to get user input
function Get-SecureUserInput ($Prompt) {
    Write-Host $Prompt -NoNewline
    return Read-Host
}

# --- Step 0: Prerequisites Reminder ---
Write-Host "`n--- Step 0: Prerequisites Reminder ---" -ForegroundColor Green
Write-Host "- TacoPKM-CLI project: 'npm install' done, then 'npm link' done in its directory."
Write-Host "- Ganache: Running, fresh instance (http://127.0.0.1:7545 recommended)."
Write-Host "- IPFS Daemon: Running, API at http://127.0.0.1:5001 (or ensure TacoPKM-CLI/.env has correct IPFS_API_URL)."
Write-Host "- Private Keys: Have two distinct private keys ready (for OWNER and USER_B)."

Pause-WithMessage "Confirm prerequisites are met. Ready for setup?"

# --- Step 1: Setup Environment & Initial Localhost Deployment ---
Write-Host "`n--- Step 1: Setup Environment & Initial Localhost Deployment ---" -ForegroundColor Green

Write-Host "Cleaning up old test artifacts (user's .tacopkm dir, local installed libs, test libs folder)..."
$UserTacoPKMDir = Join-Path ([System.Environment]::GetFolderPath("UserProfile")) ".tacopkm"
if (Test-Path $UserTacoPKMDir) {
    Write-Host "Removing old user config/keystore directory: $UserTacoPKMDir"
    Remove-Item -Recurse -Force $UserTacoPKMDir
}
$InstalledLibsDirCWD = Join-Path $ProjectRoot "tpkm_installed_libs" # tpkm install creates this in CWD
if (Test-Path $InstalledLibsDirCWD) {
    Write-Host "Removing old installed libs directory: $InstalledLibsDirCWD"
    Remove-Item -Recurse -Force $InstalledLibsDirCWD
}
if (Test-Path $TestLibsRoot) {
    Write-Host "Removing old test libraries directory: $TestLibsRoot"
    Remove-Item -Recurse -Force $TestLibsRoot
}
New-Item -ItemType Directory -Force -Path $TestLibsRoot | Out-Null
Write-Host "Cleanup complete."

Pause-WithMessage "Ensure Ganache has been RESTARTED for a fresh blockchain state. Then press Enter to deploy the contract."

Write-Host "Deploying LibraryRegistry contract to localhost (Ganache from project root '$ProjectRoot')..."
Push-Location $ProjectRoot
try {
    Write-Host "Compiling contracts..."
    npx hardhat compile
    Write-Host "Compilation complete. Deploying..."
    npx hardhat ignition deploy ignition/modules/Deploy.js --network localhost
}
finally {
    Pop-Location
}

$DeployedLocalhostContractAddress = Get-SecureUserInput "IMPORTANT: From the output above, paste the deployed 'LibraryRegistryModule#LibraryRegistry' contract address for localhost here:"
if (-not $DeployedLocalhostContractAddress -or $DeployedLocalhostContractAddress.Length -ne 42 -or -not $DeployedLocalhostContractAddress.StartsWith("0x")) {
    Write-Error "Invalid localhost contract address entered. Exiting."
    exit 1
}
Write-Host "Localhost Contract Address set to: $DeployedLocalhostContractAddress"

# Configure tpkm to use this localhost deployment
Write-Host "`nConfiguring 'tpkm' for localhost..."
tpkm config add localhost --rpc "http://127.0.0.1:7545" --contract $DeployedLocalhostContractAddress --set-active
Write-Host "`nVerifying 'localhost' configuration..."
tpkm config list
tpkm config show localhost

Pause-WithMessage "Contract deployed and 'localhost' profile configured in tpkm. Ready for Wallet Management?"

# --- Step 2: Wallet Management ---
Write-Host "`n--- Step 2: Wallet Management ---" -ForegroundColor Green
$OwnerPassword = "ownerpass123"
$UserBPassword = "userbpass456"

Write-Host "Creating OWNER wallet..."
$PK_OWNER_RAW = Get-SecureUserInput "Enter Private Key for OWNER (e.g., from Ganache Account 0, WITHOUT '0x' prefix):"
if (-not $PK_OWNER_RAW) { Write-Error "Owner Private Key is required!"; exit 1 }
$PK_OWNER = "0x" + $PK_OWNER_RAW
tpkm wallet import $PK_OWNER --password $OwnerPassword
Write-Host "OWNER wallet imported. Verifying address (will prompt for '$OwnerPassword')..."
tpkm wallet address
$OwnerAddress = Get-SecureUserInput "Copy the 'Current wallet address' from above for OWNER and paste here:"
if (-not $OwnerAddress -or -not $OwnerAddress.StartsWith("0x")) { Write-Error "Owner address not captured or invalid. Exiting."; exit 1 }
Write-Host "OWNER Address captured: $OwnerAddress"

Write-Host "`nCreating USER_B wallet (will overwrite current keystore)..."
$PK_USER_B_RAW = Get-SecureUserInput "Enter Private Key for USER_B (e.g., from Ganache Account 1, DIFFERENT from OWNER, WITHOUT '0x' prefix):"
if (-not $PK_USER_B_RAW) { Write-Error "User B Private Key is required!"; exit 1 }
$PK_USER_B = "0x" + $PK_USER_B_RAW
tpkm wallet import $PK_USER_B --password $UserBPassword
Write-Host "USER_B wallet imported. Verifying address (will prompt for '$UserBPassword')..."
tpkm wallet address
$UserBAddress = Get-SecureUserInput "Copy the 'Current wallet address' from above for USER_B and paste here:"
if (-not $UserBAddress -or -not $UserBAddress.StartsWith("0x")) { Write-Error "User B address not captured or invalid. Exiting."; exit 1 }
Write-Host "USER_B Address captured: $UserBAddress"

# Restore OWNER's wallet as the active wallet for subsequent admin tasks
Write-Host "`nRestoring OWNER wallet as active..."
tpkm wallet import $PK_OWNER --password $OwnerPassword
Write-Host "OWNER wallet is now active. Verifying (will prompt for '$OwnerPassword')..."
tpkm wallet address

Pause-WithMessage "Wallet management tests complete. Ready for further Network Configuration tests?"

# --- Step 3: Further Network Configuration (Optional Sepolia) ---
Write-Host "`n--- Step 3: Further Network Configuration (Optional Sepolia) ---" -ForegroundColor Green
$SepoliaRPCUserProvided = Get-SecureUserInput "Enter your Sepolia RPC URL (or press Enter to skip Sepolia tests):"
if ($SepoliaRPCUserProvided) {
    $SepoliaContractAddressUserProvided = Get-SecureUserInput "Enter your DEPLOYED LibraryRegistry contract address on Sepolia (REQUIRED if using Sepolia):"
    if (-not $SepoliaContractAddressUserProvided -or -not $SepoliaContractAddressUserProvided.StartsWith("0x")) {
        Write-Warning "Valid Sepolia Contract Address required to test Sepolia. Skipping some Sepolia tests."
    } else {
        tpkm config add sepolia --rpc $SepoliaRPCUserProvided --contract $SepoliaContractAddressUserProvided
        Write-Host "`nListing all network configurations..."
        tpkm config list
        Write-Host "`nSetting 'sepolia' as active network..."
        tpkm config set-active sepolia
        Write-Host "`nRunning 'tpkm list' on Sepolia (EXPECTS content from your Sepolia contract)..."
        tpkm list
        Pause-WithMessage "Sepolia test 'tpkm list' complete. Observe output."
    }
    Write-Host "`nSetting 'localhost' back as active network..."
    tpkm config set-active localhost
    Write-Host "`nListing configurations again..."
    tpkm config list
    Write-Host "Verify 'localhost' is active again (*)."
    if ($SepoliaContractAddressUserProvided) { # Only try to remove if it was added
        Write-Host "`nRemoving 'sepolia' configuration..."
        tpkm config remove sepolia
        Write-Host "`nListing configurations (Sepolia should be gone)..."
        tpkm config list
    }
} else {
    Write-Host "Skipping further Sepolia configuration tests."
}

Pause-WithMessage "Network Configuration tests complete. Ready for Public Library Lifecycle tests on localhost?"

# --- Step 4: Public Library Lifecycle (No License Required) ---
Write-Host "`n--- Step 4: Public Library Lifecycle (No License Required) ---" -ForegroundColor Green
$PublicLibNoLic = "public-free-lib"
$PublicLibNoLicDir = Join-Path $TestLibsRoot $PublicLibNoLic
New-Item -ItemType Directory -Force -Path $PublicLibNoLicDir | Out-Null
Push-Location $PublicLibNoLicDir
    Write-Host "Initializing '$PublicLibNoLic' in '$PublicLibNoLicDir'..."
    tpkm init # Prompts: name=$PublicLibNoLic, ver="0.1.0", desc="Public Free Lib", lang="any"
    # Overwrite to ensure known state for test script
    Set-Content "lib.config.json" -Value ('{ "name": "' + $PublicLibNoLic + '", "version": "0.1.0", "description": "Public and free.", "language": "any" }')
    Set-Content "index.js" -Value "console.log('Hello from $PublicLibNoLic');"
Pop-Location

Write-Host "`nRegistering '$PublicLibNoLic' (will prompt for OWNER password '$OwnerPassword')..."
tpkm register $PublicLibNoLic -l "any" -d "A public and free library"

Write-Host "`nPublishing '$PublicLibNoLic@0.1.0' (will prompt for OWNER password '$OwnerPassword')..."
tpkm publish $PublicLibNoLicDir

Write-Host "`nGetting info for '$PublicLibNoLic' (observe table format and no license info)..."
tpkm info $PublicLibNoLic --versions
tpkm info "$PublicLibNoLic`@0.1.0"

Write-Host "`nInstalling '$PublicLibNoLic@0.1.0' (should NOT prompt for password for access check)..."
tpkm install "$PublicLibNoLic`@0.1.0"
$InstalledPathPublicNoLic = Join-Path $ProjectRoot "tpkm_installed_libs\$PublicLibNoLic\0.1.0\index.js"
if (Test-Path $InstalledPathPublicNoLic) { Write-Host "Installation VERIFIED: $InstalledPathPublicNoLic" -ForegroundColor Green }
else { Write-Error "Installation FAILED for $PublicLibNoLic at $InstalledPathPublicNoLic" }

Write-Host "`nDeprecating '$PublicLibNoLic@0.1.0' (will prompt for OWNER password '$OwnerPassword')..."
tpkm deprecate "$PublicLibNoLic`@0.1.0"
tpkm info "$PublicLibNoLic`@0.1.0" # Verify deprecated status

Pause-WithMessage "Public Library (No License) tests complete. Ready for Licensed Public Library tests?"

# --- Step 5: Licensed Public Library Lifecycle ---
Write-Host "`n--- Step 5: Licensed Public Library Lifecycle ---" -ForegroundColor Green
$LicensedPubLib = "licensed-public-lib"
$LicensedPubLibDir = Join-Path $TestLibsRoot $LicensedPubLib
New-Item -ItemType Directory -Force -Path $LicensedPubLibDir | Out-Null
Push-Location $LicensedPubLibDir
    Write-Host "Initializing '$LicensedPubLib' in '$LicensedPubLibDir'..."
    Set-Content "lib.config.json" -Value ('{ "name": "' + $LicensedPubLib + '", "version": "1.0.0", "description": "A public library that requires a license.", "language": "rust" }')
    Set-Content -Path "main.rs" -Value 'fn main() { println!("Hello from $LicensedPubLib"); }'
Pop-Location

Write-Host "`nRegistering '$LicensedPubLib' (will prompt for OWNER password '$OwnerPassword')..."
tpkm register $LicensedPubLib -l "rust" -d "Public Licensed Lib"

Write-Host "`nSetting license for '$LicensedPubLib': Fee 0.001 ETH, Required: true (will prompt for OWNER password '$OwnerPassword')..."
tpkm set-license $LicensedPubLib --fee "0.001 eth" --required true

Write-Host "`nPublishing '$LicensedPubLib@1.0.0' (will prompt for OWNER password '$OwnerPassword')..."
tpkm publish $LicensedPubLibDir

Write-Host "`nGetting info for '$LicensedPubLib@1.0.0'..."
tpkm info "$LicensedPubLib`@1.0.0"
Write-Host "Verify License Required: Yes, Fee: 0.001 ETH. User license status should show no license."

Write-Host "`n--- Testing Install (by USER_B - NO LICENSE - EXPECT PERMISSION DENIED) ---"
Write-Host "Switching active wallet to USER_B (will prompt for '$UserBPassword')..."
tpkm wallet import $PK_USER_B --password $UserBPassword
tpkm wallet address # Verify
Pause-WithMessage "Wallet switched to USER_B. Press Enter to attempt install of '$LicensedPubLib@1.0.0'."
tpkm install "$LicensedPubLib`@1.0.0"
Write-Host "VERIFY: Above output shows a permission error (Access Denied... requires a license...)"

Write-Host "`n--- Testing Purchase License (by USER_B) ---"
Write-Host "USER_B will now purchase the license (will prompt for USER_B password '$UserBPassword')..."
Pause-WithMessage "Ensure USER_B ($UserBAddress) has at least 0.001 ETH on Ganache. Press Enter to purchase."
tpkm purchase-license $LicensedPubLib # Amount will be fetched from contract

Write-Host "`n--- Testing Install (by USER_B - WITH LICENSE - EXPECT SUCCESS) ---"
Pause-WithMessage "USER_B now has a license. Press Enter to attempt install of '$LicensedPubLib@1.0.0'."
tpkm install "$LicensedPubLib`@1.0.0"
$InstalledPathLicensedPub = Join-Path $ProjectRoot "tpkm_installed_libs\$LicensedPubLib\1.0.0\main.rs"
if (Test-Path $InstalledPathLicensedPub) { Write-Host "Installation of licensed public lib by USER_B VERIFIED!" -ForegroundColor Green }
else { Write-Error "Installation FAILED for $LicensedPubLib by USER_B at $InstalledPathLicensedPub" }

# Restore OWNER's wallet
Write-Host "`nRestoring OWNER wallet as active (will prompt for '$OwnerPassword')..."
tpkm wallet import $PK_OWNER --password $OwnerPassword

Pause-WithMessage "Licensed Public Library tests complete. Ready for Private Library tests?"

# --- Step 6: Private Library Lifecycle & Permissions (No License Applicable for Access) ---
Write-Host "`n--- Step 6: Private Library Lifecycle & Permissions ---" -ForegroundColor Green
$PrivateLib = "my-secret-project"
$PrivateLibDir = Join-Path $TestLibsRoot $PrivateLib
New-Item -ItemType Directory -Force -Path $PrivateLibDir | Out-Null
Push-Location $PrivateLibDir
    Write-Host "Initializing '$PrivateLib'..."
    Set-Content "lib.config.json" -Value ('{ "name": "' + $PrivateLib + '", "version": "0.5.0", "description": "Super secret private project." }')
    Set-Content "secret.txt" -Value "This is a secret."
Pop-Location

Write-Host "`nRegistering '$PrivateLib' as private (will prompt for OWNER password '$OwnerPassword')..."
tpkm register $PrivateLib --private -l "proprietary"

Write-Host "`nPublishing '$PrivateLib@0.5.0' (will prompt for OWNER password '$OwnerPassword')..."
tpkm publish $PrivateLibDir

Write-Host "`n--- Testing Install of Private Lib (by USER_B - UNAUTHORIZED - EXPECT PERMISSION DENIED) ---"
Write-Host "Switching wallet to USER_B (will prompt for '$UserBPassword')..."
tpkm wallet import $PK_USER_B --password $UserBPassword
tpkm wallet address # Verify
Pause-WithMessage "Wallet is USER_B. Press Enter to attempt install of '$PrivateLib@0.5.0'."
tpkm install "$PrivateLib`@0.5.0"
Write-Host "VERIFY: Above output shows permission error (Access Denied... private library... or similar)."

Write-Host "`n--- Authorizing USER_B for '$PrivateLib' (by OWNER) ---"
Write-Host "Switching wallet to OWNER (will prompt for '$OwnerPassword')..."
tpkm wallet import $PK_OWNER --password $OwnerPassword
tpkm wallet address # Verify
Pause-WithMessage "Wallet is OWNER. Press Enter to authorize USER_B ($UserBAddress) for '$PrivateLib'."
tpkm authorize $PrivateLib $UserBAddress

Write-Host "`n--- Testing Install of Private Lib (by USER_B - NOW AUTHORIZED - EXPECT SUCCESS) ---"
Write-Host "Switching wallet to USER_B (will prompt for '$UserBPassword')..."
tpkm wallet import $PK_USER_B --password $UserBPassword
tpkm wallet address # Verify
Pause-WithMessage "Wallet is USER_B. Press Enter to attempt install of '$PrivateLib@0.5.0'."
tpkm install "$PrivateLib`@0.5.0"
$InstalledPathPrivateAccess = Join-Path $ProjectRoot "tpkm_installed_libs\$PrivateLib\0.5.0\secret.txt"
if (Test-Path $InstalledPathPrivateAccess) { Write-Host "Installation of private lib by authorized USER_B VERIFIED!" -ForegroundColor Green }
else { Write-Error "Installation FAILED for $PrivateLib by USER_B at $InstalledPathPrivateAccess" }

Write-Host "`n--- Revoking USER_B for '$PrivateLib' (by OWNER) ---"
Write-Host "Switching wallet to OWNER (will prompt for '$OwnerPassword')..."
tpkm wallet import $PK_OWNER --password $OwnerPassword
tpkm wallet address # Verify
Pause-WithMessage "Wallet is OWNER. Press Enter to revoke USER_B ($UserBAddress) from '$PrivateLib'."
tpkm revoke $PrivateLib $UserBAddress

# Restore OWNER's wallet
Write-Host "`nRestoring OWNER wallet as active (will prompt for '$OwnerPassword')..."
tpkm wallet import $PK_OWNER --password $OwnerPassword

Pause-WithMessage "Private Library & Permissions tests complete. Ready for Dependency and Deletion tests?"

# --- Step 7: Dependency Installation Test --- (Assumes public libraries for simplicity of dependencies)
# ... (Similar to previous script, ensure dependency libs (A,B,C) are public and registered/published by OWNER)
# ... (Then install A, check if B and C are pulled in)
Write-Host "`n--- Step 7: Dependency Installation Test ---" -ForegroundColor Green
$DepA = "dep-alpha"; $DepAVer = "1.0.0"; $DepADir = Join-Path $TestLibsRoot $DepA
$DepB = "dep-beta"; $DepBVer = "1.0.0"; $DepBDir = Join-Path $TestLibsRoot $DepB
$DepC = "dep-gamma"; $DepCVer = "1.0.0"; $DepCDir = Join-Path $TestLibsRoot $DepC

New-Item -ItemType Directory -Force -Path $DepCDir | Out-Null; Push-Location $DepCDir; Set-Content "lib.config.json" -Value ('{ "name": "' + $DepC + '", "version": "' + $DepCVer + '" }'); Set-Content "c.txt" -Value "C"; Pop-Location
New-Item -ItemType Directory -Force -Path $DepBDir | Out-Null; Push-Location $DepBDir; Set-Content "lib.config.json" -Value ('{ "name": "' + $DepB + '", "version": "' + $DepBVer + '", "dependencies": { "' + $DepC + '": "^' + $DepCVer + '" } }'); Set-Content "b.txt" -Value "B"; Pop-Location
New-Item -ItemType Directory -Force -Path $DepADir | Out-Null; Push-Location $DepADir; Set-Content "lib.config.json" -Value ('{ "name": "' + $DepA + '", "version": "' + $DepAVer + '", "dependencies": { "' + $DepB + '": "^' + $DepBVer + '" } }'); Set-Content "a.txt" -Value "A"; Pop-Location

Write-Host "Registering & Publishing dependency chain (A, B, C)... (will prompt for OWNER password multiple times)"
tpkm register $DepC -l "dep"; tpkm publish $DepCDir
tpkm register $DepB -l "dep"; tpkm publish $DepBDir
tpkm register $DepA -l "dep"; tpkm publish $DepADir

Write-Host "`nInstalling '$DepA@$DepAVer' (should pull $DepB and $DepC)..."
tpkm install "$DepA`@$DepAVer"
Pause-WithMessage "Verify that $DepA, $DepB, and $DepC are present in '$ProjectRoot\tpkm_installed_libs'."
# Add Test-Path checks here for $DepA, $DepB, $DepC installed paths

# --- Step 8: Library Deletion Test ---
# ... (Same as previous script, use OWNER wallet) ...
Write-Host "`n--- Step 8: Library Deletion Test ---" -ForegroundColor Green
$LibToDeleteNoVer = "temp-del-nover"
$LibToDeleteFail = "temp-del-failver"
$LibToDeleteFailDir = Join-Path $TestLibsRoot $LibToDeleteFail
New-Item -ItemType Directory -Force -Path $LibToDeleteFailDir | Out-Null; Push-Location $LibToDeleteFailDir
Set-Content "lib.config.json" -Value ('{ "name": "' + $LibToDeleteFail + '", "version": "1.0.0" }'); Set-Content "file.txt" -Value "content"; Pop-Location

Write-Host "Registering '$LibToDeleteNoVer'..."; tpkm register $LibToDeleteNoVer -l "none"
Write-Host "`nDeleting '$LibToDeleteNoVer' (should succeed)..."; tpkm delete $LibToDeleteNoVer
Write-Host "Verify '$LibToDeleteNoVer' is gone from 'tpkm list':"; tpkm list

Write-Host "`nRegistering & publishing '$LibToDeleteFail'..."; tpkm register $LibToDeleteFail -l "none"; tpkm publish $LibToDeleteFailDir
Write-Host "`nDeleting '$LibToDeleteFail' (should fail)..."; tpkm delete $LibToDeleteFail

# --- Step 9: Abandon Registry (Optional & Dangerous on Localhost) ---
# ... (Same as previous script, use OWNER wallet) ...
Write-Host "`n--- Step 9: Abandon Registry (Optional & Dangerous on Localhost) ---" -ForegroundColor Red
# ... (Warnings and confirmations) ...
$ConfirmAbandon = Get-SecureUserInput "Proceed with abandoning registry on localhost? Type 'yes-abandon-localhost' to confirm:"
if ($ConfirmAbandon -eq "yes-abandon-localhost") {
    tpkm abandon-registry # Uses active network, which should be localhost
    # ... test register after abandon ...
} else { Write-Host "Abandon Registry test skipped."}


Write-Host "`n--- ALL TACOPKM MANUAL TESTS COMPLETE ---" -ForegroundColor Green
Write-Host "Review all console outputs for expected success/failure messages."