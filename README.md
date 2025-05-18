# TacoPKM: A Blockchain-Powered Package Manager

TacoPKM is a decentralized package manager proof-of-concept utilizing blockchain technology for library metadata and version control, and IPFS for distributed artifact storage. This Command Line Interface (CLI) tool allows users to register, publish, install, and manage software libraries in a transparent and resilient manner.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [IPFS Node](#ipfs-node)
  - [Blockchain Network](#blockchain-network)
  - [Environment Variables](#environment-variables)
  - [CLI Wallet Setup](#cli-wallet-setup)
- [Smart Contract Deployment](#smart-contract-deployment)
  - [Compile](#compile)
  - [Deploy to Local Network (Ganache)](#deploy-to-local-network-ganache)
  - [Deploy to Testnet (e.g., Sepolia)](#deploy-to-testnet-eg-sepolia)
  - [Update CLI Configuration](#update-cli-configuration)
- [CLI Usage (`tpkm`)](#cli-usage-tpkm)
  - [`tpkm init`](#tpkm-init)
  - [`tpkm wallet create`](#tpkm-wallet-create)
  - [`tpkm wallet import <privateKey>`](#tpkm-wallet-import-privatekey)
  - [`tpkm wallet address`](#tpkm-wallet-address)
  - [`tpkm register <name>`](#tpkm-register-name)
  - [`tpkm list`](#tpkm-list)
  - [`tpkm info <libraryIdentifier>`](#tpkm-info-libraryidentifier)
  - [`tpkm publish <directory>`](#tpkm-publish-directory)
  - [`tpkm install <libraryIdentifier>`](#tpkm-install-libraryidentifier)
  - [`tpkm deprecate <libraryIdentifier>`](#tpkm-deprecate-libraryidentifier)
  - [`tpkm authorize <libraryName> <userAddress>`](#tpkm-authorize-libraryname-useraddress)
  - [`tpkm revoke <libraryName> <userAddress>`](#tpkm-revoke-libraryname-useraddress)
  - [`tpkm delete <libraryName>`](#tpkm-delete-libraryname)
  - [`tpkm abandon-registry`](#tpkm-abandon-registry)
- [Library Configuration (`lib.config.json`)](#library-configuration-libconfigjson)
- [Development](#development)
  - [Running Tests](#running-tests)
- [License](#license)

## Features

* Decentralized library registration and versioning on an EVM-compatible blockchain.
* Library code artifact storage on IPFS.
* Support for public and private libraries with owner-managed access control.
* Comprehensive CLI (`tpkm`) for all core operations.
* Encrypted local keystore for secure wallet management and transaction signing.
* Basic dependency management: declaration in `lib.config.json`, storage on-chain, and recursive installation with version constraint satisfaction.
* Operates on local development networks (e.g., Ganache) and public EVM testnets (e.g., Sepolia).

## Architecture Overview

TacoPKM consists of three main components:
1.  **Smart Contract (`LibraryRegistry.sol`):** Deployed on an EVM-compatible blockchain (e.g., Ganache for local dev, Sepolia for testnet). It acts as the central, immutable registry for library metadata, including names, owners, versions, IPFS CIDs for code artifacts, dependencies, and access permissions.
2.  **IPFS (InterPlanetary File System):** Used to store the actual library code archives (as `.tar.gz` files). The smart contract only stores the IPFS CID (Content Identifier) pointing to these archives.
3.  **CLI (`tpkm`):** A Node.js application that provides a user interface to interact with the smart contract and IPFS. It handles tasks like wallet management, library registration, code packaging, IPFS uploads/downloads, and transaction signing.

## Prerequisites

Before you begin, ensure you have the following installed:
* Node.js (v18+ or v20+ recommended) & npm
* IPFS:
    * Kubo CLI (`ipfs daemon`) OR
    * IPFS Desktop
    (Ensure your IPFS daemon is running and its API server is accessible, typically at `http://127.0.0.1:5001`)
* Ganache (for local blockchain development, provides an easy-to-use local EVM environment)
* Git (for cloning the repository)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Doner357/TacoPKM.git
    cd TacoPKM
    ```

2.  **Install Hardhat project dependencies (for smart contract development):**
    From the project root directory:
    ```bash
    npm install
    ```

3.  **Install CLI dependencies:**
    Navigate to the CLI directory and install its dependencies:
    ```bash
    cd cli
    npm install
    ```

4.  **Make the CLI globally available (for development):**
    While still in the `cli` directory:
    ```bash
    npm link
    ```
    This will create a symbolic link, allowing you to run the `tpkm` command from anywhere in your terminal.
    Go back to the project root:
    ```bash
    cd ..
    ```
    You should now be able to run `tpkm --version`.

## Configuration

### IPFS Node
Ensure your IPFS daemon (either Kubo via `ipfs daemon` or IPFS Desktop) is running. The CLI will connect to its API server (default: `http://127.0.0.1:5001/api/v0`). If your IPFS API is running on a different address or port, you'll need to configure it in the CLI's `.env` file.

### Blockchain Network

* **Local (Ganache):** Start your Ganache GUI application or run `ganache-cli` in a terminal. It typically runs on `http://127.0.0.1:7545` (or `8545`).
* **Testnet (e.g., Sepolia):**
    1.  Obtain a Sepolia RPC URL from a node provider like [Infura](https://infura.io/), [Alchemy](https://www.alchemy.com/), or [QuickNode](https://www.quicknode.com/).
    2.  Get Sepolia test ETH for your deployment wallet from a public faucet (e.g., [sepoliafaucet.com](https://sepoliafaucet.com/), [infura.io/faucet/sepolia](https://www.infura.io/faucet/sepolia)).

### Environment Variables

TacoPKM uses `.env` files for configuration.

1.  **Project Root `.env` (for Hardhat smart contract deployment):**
    Create a `.env` file in the project's root directory (e.g., `tacopkm/.env`). This is primarily used by Hardhat when deploying to testnets.
    ```dotenv
    # tacopkm/.env
    # Used by hardhat.config.js for deploying to testnets
    SEPOLIA_RPC_URL="your_sepolia_rpc_url_from_infura_or_alchemy"
    TESTNET_PRIVATE_KEY="your_deployer_wallet_private_key_with_sepolia_eth"
    ```

2.  **CLI `.env` (for CLI operations):**
    Create a `.env` file inside the `cli/` directory (`tacopkm/cli/.env`).
    ```dotenv
    # tacopkm/cli/.env
    # RPC URL of the blockchain network the CLI should connect to
    RPC_URL="http://127.0.0.1:7545" # For Ganache, or your_sepolia_rpc_url_here for Sepolia

    # Address of the deployed LibraryRegistry smart contract
    CONTRACT_ADDRESS="your_deployed_LibraryRegistry_contract_address_here"

    # API URL of your IPFS node
    IPFS_API_URL="http://127.0.0.1:5001/api/v0" # Or your remote IPFS API URL (e.g., from your Debian server)

    # Optional: For non-interactive wallet password input (less secure, use with caution)
    # TPKM_WALLET_PASSWORD="your_wallet_password_if_you_want_to_skip_prompts"
    ```
    **Note:** `SIGNER_PRIVATE_KEY` is NO LONGER USED here. Wallet management is handled via encrypted keystore.

### CLI Wallet Setup
TacoPKM CLI uses an encrypted JSON keystore file to manage the wallet used for signing transactions. This keystore is stored by default in `~/.tacopkm/keystore.json` (where `~` is your user home directory).

* **Create a new wallet:**
    ```bash
    tpkm wallet create
    ```
    Follow the prompts to set a strong password. The CLI will generate a new Ethereum account, encrypt its private key with your password, and save it. **Make sure to back up your password securely.** The new wallet's public address will be displayed.

* **Import an existing private key:**
    ```bash
    tpkm wallet import <your_existing_private_key>
    ```
    Replace `<your_existing_private_key>` with your actual private key (usually a 64-character hex string, optionally prefixed with `0x`). You will be prompted to set a password to encrypt this imported key.

* **View configured wallet address:**
    ```bash
    tpkm wallet address
    ```
    You will be prompted for your wallet password.

**Ensure the wallet address used by the CLI has funds (ETH on Ganache, or Sepolia ETH on Sepolia) to pay for transaction gas fees.**

## Smart Contract Deployment

### Compile
From the project root directory:
```bash
npx hardhat compile
```

### Deploy to Local Network (Ganache)
Ensure Ganache is running. From the project root directory:
```bash
npx hardhat ignition deploy ignition/modules/Deploy.js --network localhost
```

### Deploy to Testnet (e.g., Sepolia)
Ensure your project root `.env` file is configured with `SEPOLIA_RPC_URL` and `TESTNET_PRIVATE_KEY` (this key must have Sepolia ETH). From the project root directory:
```bash
npx hardhat ignition deploy ignition/modules/Deploy.js --network sepolia
```
If you encounter a "reconciliation failed" error due to previous deployments of the same module on the same network with changed bytecode, you might need to use the `--force` flag (use with caution):
```bash
npx hardhat ignition deploy ignition/modules/Deploy.js --network sepolia --force
```

### Update CLI Configuration
After successful deployment (to localhost or Sepolia), Hardhat Ignition will output the deployed contract address (e.g., `LibraryRegistryModule#LibraryRegistry - 0x...`).
**Copy this new contract address** and update the `CONTRACT_ADDRESS` variable in your `cli/.env` file. Also, ensure the `RPC_URL` in `cli/.env` points to the correct network (Ganache or Sepolia).

## CLI Usage (`tpkm`)

All commands are run using the `tpkm` executable (if `npm link` was successful) or `node index.js` from within the `cli/` directory. Commands that send transactions will prompt for your wallet password.

### `tpkm init`
Initializes a new `lib.config.json` file in the current directory, prompting for library details.
```bash
tpkm init
```

### `tpkm wallet create`
Creates a new Ethereum wallet, encrypts it with a password you provide, and stores it locally as a keystore file (default: `~/.tacopkm/keystore.json`).
```bash
tpkm wallet create
tpkm wallet create --password "yourSuperSecretPassword" # Less secure: password in history
```

### `tpkm wallet import <privateKey>`
Imports an existing private key, encrypts it with a password you provide, and stores it as the local keystore file, overwriting any existing one.
```bash
tpkm wallet import 0xabcdef12345...
tpkm wallet import 0xabcdef12345... --password "yourSuperSecretPassword"
```

### `tpkm wallet address`
Displays the public address of the wallet currently configured in the local keystore. Prompts for password to decrypt.
```bash
tpkm wallet address
```

### `tpkm register <name>`
Registers a new library name on the blockchain.
-   **Arguments:**
    -   `<name>`: The unique name for the library.
-   **Options:**
    -   `-d, --description <text>`: Library description.
    -   `-t, --tags <tags>`: Comma-separated tags (e.g., "utils,math").
    -   `-l, --language <language>`: Primary programming language (e.g., "javascript", "c++").
    -   `--private`: Set the library as private.
-   **Example:**
    ```bash
    tpkm register my-utils -d "Utility functions" -t "js,helpers" -l javascript
    tpkm register my-corp-internal-lib --private -l java
    ```

### `tpkm list`
Lists all registered library names.
```bash
tpkm list
```
*Note: On large public networks, this might be slow or incur costs if it were to read extensive data.*

### `tpkm info <libraryIdentifier>`
Displays information about a registered library.
-   **Arguments:**
    -   `<libraryIdentifier>`: Can be just the library name (e.g., `my-utils`) or name with version (e.g., `my-utils@1.0.0`).
-   **Options:**
    -   `--versions`: If only library name is provided, this flag lists all published versions for that library.
-   **Examples:**
    ```bash
    tpkm info my-utils
    tpkm info my-utils --versions
    tpkm info my-utils@1.0.2
    ```

### `tpkm publish <directory>`
Publishes a new version of a library from the specified directory. The directory must contain a `lib.config.json` file.
-   **Arguments:**
    -   `<directory>`: Path to the library's root directory.
-   **Options:**
    -   `-v, --version <version>`: Semantic version string (e.g., "1.0.0"). If provided, it overrides the version in `lib.config.json`.
-   **Example:**
    ```bash
    tpkm publish ./my-library-source/
    tpkm publish ./my-library-source/ -v 1.0.1
    ```

### `tpkm install <libraryIdentifier>`
Downloads and extracts a library version and its dependencies.
-   **Arguments:**
    -   `<libraryIdentifier>`: The library and version to install, in the format `name@version` (e.g., `my-utils@1.0.0`).
-   **Example:**
    ```bash
    tpkm install my-utils@1.0.0
    ```
    Installed libraries are placed in `./tpkm_installed_libs/<libraryName>/<version>/` relative to where the command is run.

### `tpkm deprecate <libraryIdentifier>`
Marks a specific library version as deprecated. Only the library owner can do this.
-   **Arguments:**
    -   `<libraryIdentifier>`: The library and version to deprecate (`name@version`).
-   **Example:**
    ```bash
    tpkm deprecate my-utils@0.9.0
    ```

### `tpkm authorize <libraryName> <userAddress>`
Grants a user (by their Ethereum address) access to a private library. Only the library owner can do this.
-   **Arguments:**
    -   `<libraryName>`: The name of the private library.
    -   `<userAddress>`: The Ethereum address of the user to authorize.
-   **Example:**
    ```bash
    tpkm authorize my-secret-lib 0x123...abc
    ```

### `tpkm revoke <libraryName> <userAddress>`
Revokes a user's access to a private library. Only the library owner can do this.
-   **Arguments:**
    -   `<libraryName>`: The name of the private library.
    -   `<userAddress>`: The Ethereum address of the user whose authorization is to be revoked.
-   **Example:**
    ```bash
    tpkm revoke my-secret-lib 0x123...abc
    ```

### `tpkm delete <libraryName>`
Deletes a registered library. Only the library owner can do this, and **only if no versions have ever been published for that library.** This is intended for correcting registration mistakes.
-   **Arguments:**
    -   `<libraryName>`: The name of the library to delete.
-   **Example:**
    ```bash
    tpkm delete my-typoed-libname
    ```

### `tpkm abandon-registry`
**IRREVERSIBLE ACTION!** Transfers ownership of the currently configured `LibraryRegistry` smart contract to a specified burn address (default: `0x...dEaD`). After this, no owner-only functions can be called on that contract instance.
-   **Options:**
    -   `--burn-address <address>`: Specify the burn address.
    -   `--network <networkName>`: Specify the network name for confirmation prompt.
-   **Example:**
    ```bash
    tpkm abandon-registry --network sepolia
    ```
    The command will require multiple explicit confirmations due to its destructive nature.

## Library Configuration (`lib.config.json`)

When publishing a library using `tpkm publish <directory>`, the CLI expects a `lib.config.json` file in the root of that `<directory>`. You can create this file manually or by running `tpkm init` within the directory.

**Fields:**
-   `name` (string, required): The name of the library. This **must match** a library name you have already registered on the blockchain and own.
-   `version` (string, required): The semantic version of this specific library release (e.g., "1.0.0", "0.2.1-beta").
-   `description` (string, optional): A short description of the library.
-   `language` (string, optional): The primary programming language of the library (e.g., "javascript", "python", "c++").
-   `dependencies` (object, optional): An object where keys are the names of dependent TacoPKM libraries and values are their semantic version constraints.
    ```json
    {
      "dependent-lib-A": "^1.2.0",
      "another-lib": "~0.4.1"
    }
    ```

**Example `lib.config.json`:**
```json
{
  "name": "my-data-processor",
  "version": "1.1.0",
  "description": "A library for processing complex data structures.",
  "language": "python",
  "dependencies": {
    "data-validator": "^2.0.0",
    "logging-utils": "~1.0.5"
  }
}
```

## Development

### Running Tests
To run the smart contract tests (located in the `test/` directory of the project root):
```bash
npx hardhat test
```

## License

MIT