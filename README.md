# TacoPKM: A Blockchain-Powered Package Management System

TacoPKM is a proof-of-concept for a decentralized package management system. It leverages blockchain technology (specifically EVM-compatible chains) for immutable library metadata, ownership, and version control, combined with IPFS for distributed storage of actual code artifacts. This repository contains the core `LibraryRegistry` smart contract and the development environment for it.

Users interact with the TacoPKM system primarily through the [TacoPKM-CLI](https://github.com/Doner357/TacoPKM-CLI/tree/license-fee).

## Table of Contents

- [Features](#features)
- [Important Considerations: Access Control & IPFS](#important-considerations-access-control--ipfs)
- [Architecture Overview](#architecture-overview)
- [System Components](#system-components)
- [Prerequisites](#prerequisites)
- [Smart Contract Project Setup](#smart-contract-project-setup)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
- [Environment Variables (for Smart Contract Deployment)](#environment-variables-for-smart-contract-deployment)
- [Smart Contract Development](#smart-contract-development)
  - [Compiling](#compiling)
  - [Running Tests](#running-tests)
- [Smart Contract Deployment](#smart-contract-deployment)
  - [Using Hardhat Ignition](#using-hardhat-ignition)
  - [Deploy to Local Network (e.g., Ganache/Hardhat Network)](#deploy-to-local-network-eg-ganachehardhat-network)
  - [Deploy to Testnet (e.g., Sepolia)](#deploy-to-testnet-eg-sepolia)
  - [Post-Deployment: Configuring the CLI](#post-deployment-configuring-the-cli)
- [Core Concepts & Functionality](#core-concepts--functionality)
- [Interacting with TacoPKM](#interacting-with-tacopkm)
- [License](#license)

## Features

* **Decentralized Registry:** Library metadata (name, owner, versions, IPFS CIDs, dependencies) stored on an EVM-compatible blockchain.
* **Immutable History:** Version information and ownership records are tamper-resistant.
* **Distributed Storage:** Library code artifacts (.tar.gz archives) are stored on IPFS, referenced by CIDs in the smart contract.
* **Access Control:** Supports public libraries, private libraries with owner-managed authorization, and public libraries requiring purchasable licenses.
* **Dependency Management:** The smart contract stores dependency relationships (library name and semantic version constraints) for each published version.
* **Ownership & Administration:** Clear ownership of library records and administrative functions for the registry contract itself (e.g., potential for pausing, fee changes, or abandonment, depending on implementation).

## Important Considerations: Access Control & IPFS

TacoPKM uses a smart contract on an EVM-compatible blockchain to manage library metadata, versioning, and access control rules (public, private, licensed). The actual library code archives are stored on IPFS.

**Understanding the Access Model:**

* **Smart Contract as Gatekeeper:** The `LibraryRegistry` smart contract is the source of truth for permissions. The `tpkm` CLI tool is designed to respect and enforce these on-chain rules. For example, `tpkm install` will check `hasAccess` before downloading, and `tpkm info` (for specific versions) will similarly check access before displaying sensitive details like the IPFS CID for restricted libraries.
* **IPFS is a Public Network:** Once data is on IPFS and its Content Identifier (CID) is known, that data is potentially retrievable by anyone with IPFS access. IPFS itself does not inherently provide private storage or access control for individual CIDs in its public DHT.
* **CLI as the Primary Enforcement Interface:** TacoPKM's primary mechanism for enforcing license purchases or private library authorizations is through the `tpkm` CLI.

**Potential Loopholes for Advanced Users (The "Vulnerability"):**

It's important for users, especially library publishers relying on privacy or licensing, to understand the following:

1.  **Metadata Transparency:** Most metadata stored on the blockchain (library names, versions, owners, whether a license is required, license fees) is generally public or can be discovered by interacting directly with the smart contract or by analyzing blockchain transactions.
2.  **IPFS CID Exposure:**
    * **Direct Contract Interaction:** A technically savvy user with knowledge of the smart contract's ABI (which is bundled with this open-source CLI) could write their own script to call public `view` functions (like `getVersionInfo`) on the `LibraryRegistry` contract directly, potentially retrieving IPFS CIDs even if the `tpkm info` command would hide them based on access rights.
    * **Event Logs:** Blockchain events (like `VersionPublished`, which includes the IPFS hash) are public. Users can query historical events to find CIDs.
    * **Transaction Data:** The IPFS hash is part of the input data when `publishVersion` is called. This transaction data is public on the blockchain.

**What This Means:**

* The access control features in TacoPKM (private libraries, license requirements) are primarily enforced by the **`tpkm` CLI tool**. The CLI acts as a "gatekeeper" that respects the on-chain rules.
* **It is technically possible for determined users to circumvent the `tpkm` CLI and obtain IPFS CIDs for libraries they might not have "official" access to (e.g., a license they haven't purchased for a public-licensed library).** Once they have the CID, they can attempt to download the content directly from IPFS.

**Mitigation and Scope:**

* **Content Encryption (Not Implemented):** For true confidentiality of library content stored on IPFS (preventing download even if the CID is known), the library archive itself would need to be encrypted by the publisher before uploading to IPFS. Decryption keys would then need to be securely distributed only to authorized/licensed users (e.g., via a separate off-chain mechanism). **TacoPKM does not currently implement content encryption or key management.**
* **Current Design Focus:** TacoPKM's current design focuses on providing a clear, on-chain record of ownership and access rules, with the `tpkm` CLI being the primary interface for respectful interaction with these rules. The hiding of IPFS CIDs in `tpkm info` for restricted libraries is a user-experience measure to guide users through the intended `tpkm install` and `tpkm purchase-license` flows, rather than an unbreakable technical barrier against obtaining the CID through other means.
* **Legal & Community Norms:** In many ecosystems, even if content is technically accessible, its use is governed by licensing terms and community norms.

**Publisher Advisory:**
If you are publishing sensitive or commercial libraries and require strong guarantees against unauthorized access to the *content itself*, you should consider implementing an additional layer of end-to-end encryption for your library archives before publishing them with TacoPKM, and manage key distribution separately. For typical open-source or "source-available with paid license for usage" models, the current TacoPKM mechanism provides a good balance of transparency and controlled access via its official tooling.

## Architecture Overview

TacoPKM consists of three main conceptual components:
1.  **`LibraryRegistry.sol` Smart Contract:** The heart of the system, deployed on an EVM-compatible blockchain. It serves as the trusted, decentralized registry for all library metadata and rules.
2.  **IPFS (InterPlanetary File System):** Employed for storing the actual library code archives. The smart contract holds only the IPFS CIDs, ensuring content-addressable and resilient storage.
3.  **TacoPKM-CLI:** A separate Node.js command-line interface application that enables users to interact with the `LibraryRegistry` smart contract and IPFS. It handles wallet interactions, transaction signing, code packaging, and IPFS operations.

This repository is focused on the `LibraryRegistry.sol` smart contract.

## System Components

* **Smart Contract (`contracts/LibraryRegistry.sol`):** Defines the logic for library registration, version publishing, access control, licensing, and dependency tracking. (Solidity version: `0.8.20`)
* **IPFS:** External distributed storage network. Not part of this repository but essential for the system's operation.
* **[TacoPKM-CLI](https://github.com/Doner357/TacoPKM-CLI/tree/license-fee):** The official client for interacting with the TacoPKM system. (Separate Repository)

## Prerequisites

To develop, test, and deploy the `LibraryRegistry` smart contract, you'll need:
* Node.js (v18+ or v20+ recommended) & npm
* Git (for cloning this repository)
* An Ethereum development environment like Ganache (for local testing) or access to a testnet like Sepolia.
* An IPFS node (Kubo CLI or IPFS Desktop) running and accessible if you plan to test end-to-end flows that involve the CLI.

## Smart Contract Project Setup

### 1. Clone the Repository
```bash
git clone --branch license-fee --single-branch https://github.com/Doner357/TacoPKM.git
cd TacoPKM
````

### 2\. Install Dependencies

Install Hardhat project dependencies (for smart contract development and deployment):

```bash
npm install
```

This will install Hardhat, `@nomicfoundation/hardhat-toolbox`, `dotenv`, and other necessary packages.

## Environment Variables (for Smart Contract Deployment)

This project uses a `.env` file in the root directory (`TacoPKM/.env`) to manage sensitive information for deployment, primarily to testnets.

Create a `.env` file in the project root:

```dotenv
# TacoPKM/.env

# Required for deploying to Sepolia or other testnets
SEPOLIA_RPC_URL="your_sepolia_rpc_url_from_infura_alchemy_etc"
TESTNET_PRIVATE_KEY="your_deployer_wallet_private_key_with_testnet_eth"

# Optional: Etherscan API Key for contract verification
# ETHERSCAN_API_KEY="your_etherscan_api_key"
```

Ensure the `TESTNET_PRIVATE_KEY` account is funded with the native currency of the target testnet (e.g., SepoliaETH).

## Smart Contract Development

### Compiling

To compile the smart contracts:

```bash
npx hardhat compile
```

The contracts are compiled with Solidity version `0.8.20`, optimizer enabled (200 runs), and `viaIR` set to true, as per `hardhat.config.js`.

### Running Tests

Smart contract tests are located in the `test/` directory. To run them:

```bash
npx hardhat test
```

## Smart Contract Deployment

### Using Hardhat Ignition

Deployment is managed using Hardhat Ignition. The deployment module is typically located in `ignition/modules/`.

### Deploy to Local Network (e.g., Ganache/Hardhat Network)

1.  Ensure your local Ethereum node (e.g., Ganache GUI or `npx hardhat node`) is running.
      * If using Ganache, it typically runs on `http://127.0.0.1:7545`.
      * The `hardhat.config.js` defines a `localhost` network pointing to `http://127.0.0.1:7545`.
2.  Deploy the contract:
    ```bash
    npx hardhat ignition deploy ignition/modules/Deploy.js --network localhost
    ```

### Deploy to Testnet (e.g., Sepolia)

1.  Ensure your `TacoPKM/.env` file is correctly configured with `SEPOLIA_RPC_URL` and `TESTNET_PRIVATE_KEY`.
2.  Deploy the contract:
    ```bash
    npx hardhat ignition deploy ignition/modules/Deploy.js --network sepolia
    ```
    If you encounter a "reconciliation failed" error due to previous deployments of the same module on the same network with changed bytecode, you might need to use the `--reset` flag (use with caution as it can lead to orphaned deployment data if not managed carefully):
    ```bash
    npx hardhat ignition deploy ignition/modules/Deploy.js --network sepolia --reset
    ```

### Post-Deployment: Configuring the CLI

After successfully deploying the `LibraryRegistry` contract, Hardhat Ignition will output the deployed contract address (e.g., `LibraryRegistryModule#LibraryRegistry - 0x...`).

This **contract address** and the **RPC URL** of the network you deployed to are crucial for configuring the [TacoPKM-CLI](https://github.com/Doner357/TacoPKM-CLI/tree/license-fee) so it can interact with your deployed registry instance. Refer to the TacoPKM-CLI's documentation for instructions on setting its network configuration (typically via `tpkm config add` or its own `.env` file).

## Core Concepts & Functionality

The `LibraryRegistry.sol` smart contract provides the on-chain foundation for:

  * **Library Registration:** Owners can register unique library names.
  * **Version Publishing:** Owners can publish new versions, linking them to an IPFS CID containing the code archive and specifying dependencies.
  * **Access Control:**
      * **Public Libraries:** Accessible by anyone by default.
      * **Private Libraries:** Access restricted to authorized addresses explicitly granted permission by the owner.
      * **Licensed Libraries:** Public libraries can require a purchasable license (potentially with a fee) for access.
  * **Information Retrieval:** Functions to query library details, versions, owner, access rights, license status, etc.
  * **Deprecation:** Owners can mark specific versions as deprecated.
  * **Ownership Management:** Standard Ownable patterns for library records and potentially for the contract itself.

## Interacting with TacoPKM

End-users and developers interact with the deployed TacoPKM system (the smart contract and IPFS) using the **[TacoPKM-CLI](https://github.com/Doner357/TacoPKM-CLI/tree/license-fee)**.

The CLI handles:

  * Wallet creation and management.
  * Packaging libraries and uploading them to IPFS.
  * Signing and sending transactions to the `LibraryRegistry` contract for operations like `register`, `publish`, `install`, `authorize`, `set-license`, etc.
  * Querying library information.

Please refer to the [TacoPKM-CLI](https://github.com/Doner357/TacoPKM-CLI/tree/license-fee) for detailed usage instructions.

## License

MIT