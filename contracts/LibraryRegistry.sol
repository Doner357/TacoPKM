// contracts/LibraryRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // For purchaseLibraryLicense

contract LibraryRegistry is Ownable, ReentrancyGuard {

    // --- Structs ---
    struct Dependency {
        string name;
        string constraint;
    }

    struct VersionData {
        string ipfsHash;
        address publisher;
        uint256 timestamp;
        bool deprecated;
        Dependency[] dependencies;
    }

    struct Library {
        address owner;
        string description;
        string[] tags;
        bool isPrivate;
        string language;
        uint256 licenseFee;
        bool licenseRequired;
        mapping(string => VersionData) versions;
        mapping(address => bool) authorizedUsers;
        string[] versionNumbers;
    }

    // --- State Variables ---
    mapping(string => Library) private libraries;
    mapping(string => mapping(address => bool)) private libraryLicenses; // NEW: libraryName => userAddress => hasLicense
    string[] private libraryNames;
    mapping(string => bool) private libraryExists; // Used to check if a library name is taken

    // --- Events ---
    event LibraryRegistered(
        string indexed name,
        address indexed owner,
        bool isPrivate,
        string language
    );
    event VersionPublished(string indexed libraryName, string version, string ipfsHash, address indexed publisher);
    event VersionDeprecated(string indexed libraryName, string version);
    event AuthorizationGranted(string indexed libraryName, address indexed user);
    event AuthorizationRevoked(string indexed libraryName, address indexed user);
    event LibraryDeleted(string indexed name);

    // NEW Events for Licensing
    event LibraryLicenseConfigSet(
        string indexed name,
        uint256 feeInWei,
        bool required
    );
    event LibraryLicensePurchased(
        string indexed name,
        address indexed buyer,
        address indexed libraryOwner,
        uint256 feePaid // The actual fee amount, not necessarily msg.value if overpayment is refunded
    );


    // --- Modifiers ---
    modifier onlyLibraryOwner(string memory libraryName) {
        require(libraryExists[libraryName], "LibraryRegistry: Library does not exist");
        require(libraries[libraryName].owner == msg.sender, "LibraryRegistry: Caller is not the owner");
        _;
    }

    modifier libraryMustExist(string memory libraryName) {
        require(libraryExists[libraryName], "LibraryRegistry: Library does not exist");
        _;
    }

    modifier versionMustExist(string memory libraryName, string memory version) {
        require(libraryExists[libraryName], "LibraryRegistry: Library does not exist"); // Also check lib exists
        require(bytes(libraries[libraryName].versions[version].ipfsHash).length != 0, "LibraryRegistry: Version does not exist");
        _;
    }


    // --- Constructor ---
    constructor() Ownable(msg.sender) {}

    // --- Core Functions ---

    /**
     * @notice Registers a new library.
     * @param name Unique name of the library.
     * @param description Library description.
     * @param tags Relevant tags.
     * @param isPrivate Whether the library is private.
     * @param _language The primary programming language.
     */
    function registerLibrary(
        string calldata name,
        string calldata description,
        string[] calldata tags,
        bool isPrivate,
        string calldata _language
    ) external {
        require(!libraryExists[name], "LibraryRegistry: Library name already exists");

        Library storage newLibrary = libraries[name];
        newLibrary.owner = msg.sender;
        newLibrary.description = description;
        newLibrary.tags = tags;
        newLibrary.isPrivate = isPrivate;
        newLibrary.language = _language;
        newLibrary.licenseFee = 0; // Default: no fee
        newLibrary.licenseRequired = false; // Default: not required

        libraryExists[name] = true;
        libraryNames.push(name);

        emit LibraryRegistered(name, msg.sender, isPrivate, _language);
    }

    function publishVersion(
        string calldata libraryName,
        string calldata version,
        string calldata ipfsHash,
        Dependency[] calldata _dependencies
    ) external onlyLibraryOwner(libraryName) libraryMustExist(libraryName) { // ensure libraryMustExist is used
        require(bytes(libraries[libraryName].versions[version].ipfsHash).length == 0, "LibraryRegistry: Version already exists");
        require(bytes(ipfsHash).length > 0, "LibraryRegistry: IPFS hash cannot be empty");

        VersionData storage newVersion = libraries[libraryName].versions[version];
        newVersion.ipfsHash = ipfsHash;
        newVersion.publisher = msg.sender;
        newVersion.timestamp = block.timestamp;
        newVersion.deprecated = false;
        newVersion.dependencies = _dependencies;

        libraries[libraryName].versionNumbers.push(version);

        emit VersionPublished(libraryName, version, ipfsHash, msg.sender);
    }

    function deprecateVersion(
        string calldata libraryName,
        string calldata version
    ) external onlyLibraryOwner(libraryName) versionMustExist(libraryName, version) { // versionMustExist implies libraryMustExist
        libraries[libraryName].versions[version].deprecated = true;
        emit VersionDeprecated(libraryName, version);
    }

    function deleteLibrary(string calldata name) external onlyLibraryOwner(name) libraryMustExist(name) {
        Library storage lib = libraries[name];
        require(lib.versionNumbers.length == 0, "LibraryRegistry: Cannot delete library with published versions.");

        delete libraryExists[name]; // Mark name as available again
        delete libraries[name];     // Clear library struct data

        // Remove from libraryNames array (swap and pop)
        for (uint i = 0; i < libraryNames.length; i++) {
            if (keccak256(abi.encodePacked(libraryNames[i])) == keccak256(abi.encodePacked(name))) {
                libraryNames[i] = libraryNames[libraryNames.length - 1];
                libraryNames.pop();
                break;
            }
        }
        emit LibraryDeleted(name);
    }


    // --- Licensing Functions ---

    /**
     * @notice Sets or updates the license fee and requirement for a library.
     * @dev Only the library owner can call this.
     * @param name The name of the library.
     * @param feeInWei The license fee in Wei. Set to 0 for no fee.
     * @param required If true, a license is generally required for access.
     */
    function setLibraryLicense(
        string calldata name,
        uint256 feeInWei,
        bool required
    ) external onlyLibraryOwner(name) libraryMustExist(name) {
        Library storage lib = libraries[name];
        if (required == true) {
            require(!lib.isPrivate, "LibraryRegistry: Private libraries cannot require a license for access via purchase; use direct authorization.");
        }
        lib.licenseFee = feeInWei;
        lib.licenseRequired = required; // For public libs, this will gate access; for private, it should remain false.
        emit LibraryLicenseConfigSet(name, feeInWei, required);
    }

    /**
     * @notice Allows a user to purchase a license for a library.
     * @dev Sends the specified license fee to the library owner and refunds overpayment.
     * @param name The name of the library to purchase a license for.
     */
    function purchaseLibraryLicense(
        string calldata name
    ) external payable nonReentrant libraryMustExist(name) {
        Library storage lib = libraries[name];
        address buyer = msg.sender;
        address payable libraryOwner = payable(lib.owner);

        require(lib.licenseRequired, "LibraryRegistry: License not required for this library.");
        require(!libraryLicenses[name][buyer], "LibraryRegistry: License already owned by this address.");

        uint256 fee = lib.licenseFee;
        require(msg.value >= fee, "LibraryRegistry: Insufficient Ether sent. Required exact fee or more.");

        libraryLicenses[name][buyer] = true;

        // Transfer the exact fee to the library owner, if the fee is greater than 0.
        if (fee > 0) {
            (bool sent, ) = libraryOwner.call{value: fee}("");
            require(sent, "LibraryRegistry: Failed to send Ether to library owner.");
        }

        // Refund any overpayment to the buyer.
        if (msg.value > fee) {
            (bool refunded, ) = payable(buyer).call{value: msg.value - fee}("");
            require(refunded, "LibraryRegistry: Failed to refund overpayment to buyer.");
        }

        emit LibraryLicensePurchased(name, buyer, libraryOwner, fee); // Emit the actual fee, not msg.value
    }

    // --- Permission Management ---
    function authorizeUser(
        string calldata libraryName,
        address userAddress
    ) external onlyLibraryOwner(libraryName) libraryMustExist(libraryName) {
        require(libraries[libraryName].isPrivate, "LibraryRegistry: Library is not private");
        require(userAddress != address(0), "LibraryRegistry: Invalid user address");
        // Additional check: cannot authorize if user already owns a license for this specific library?
        // Or, authorization is a separate/override mechanism. Current logic allows both.
        // if (libraries[libraryName].licenseRequired && libraryLicenses[libraryName][userAddress]) {
        //     revert("LibraryRegistry: User already has access via a purchased license.");
        // }
        libraries[libraryName].authorizedUsers[userAddress] = true;
        emit AuthorizationGranted(libraryName, userAddress);
    }

    function revokeAuthorization(
        string calldata libraryName,
        address userAddress
    ) external onlyLibraryOwner(libraryName) libraryMustExist(libraryName) {
        require(libraries[libraryName].isPrivate, "LibraryRegistry: Library is not private");
        // No need to check if userAddress is address(0) here, delete on zero address is fine.
        delete libraries[libraryName].authorizedUsers[userAddress];
        emit AuthorizationRevoked(libraryName, userAddress);
    }


    // --- Query Functions ---

    /**
     * @notice Checks if a user has access to a library.
     * Access is granted if:
     * 1. The user is the owner.
     * 2. The library is public (not private AND not license-required).
     * 3. The library requires a license, AND the user has purchased one.
     * 4. The library is private (regardless of license requirement), AND the user is specifically authorized by the owner.
     */
    function hasAccess(
        string calldata libraryName,
        address userAddress
    ) public view libraryMustExist(libraryName) returns (bool) {
        Library storage lib = libraries[libraryName];

        if (userAddress == address(0)) return false;
        if (lib.owner == userAddress) {
            return true;
        }

        if (lib.isPrivate) { // If private, only authorized users (and owner)
            return lib.authorizedUsers[userAddress];
        }

        // If public (not private)
        if (lib.licenseRequired) { // And license is required
            return libraryLicenses[libraryName][userAddress]; // Check for license
        }

        // If public and no license required
        return true;
    }

    /**
     * @notice Checks if a user specifically owns a license for a library.
     * This is a direct check on the license purchase, ignoring ownership or other authorizations.
     */
    function hasUserLicense(
        string calldata libraryName,
        address userAddress
    ) public view libraryMustExist(libraryName) returns (bool) {
        if (userAddress == address(0)) return false;
        return libraryLicenses[libraryName][userAddress];
    }

    /**
     * @notice Gets basic information about a library including license details.
     */
    function getLibraryInfo(
        string calldata libraryName
    ) public view libraryMustExist(libraryName) returns (
        address owner,
        string memory description,
        string[] memory tags,
        bool isPrivate,
        string memory language,
        uint256 licenseFee,      // NEW
        bool licenseRequired    // NEW
    ) {
        Library storage lib = libraries[libraryName];
        return (
            lib.owner,
            lib.description,
            lib.tags,
            lib.isPrivate,
            lib.language,
            lib.licenseFee,
            lib.licenseRequired
        );
    }

    // getVersionInfo, getVersionNumbers, getAllLibraryNames remain unchanged
    function getVersionInfo(
        string calldata libraryName,
        string calldata version
    ) public view libraryMustExist(libraryName) versionMustExist(libraryName, version) returns (string memory ipfsHash, address publisher, uint256 timestamp, bool deprecated, Dependency[] memory dependencies) {
        VersionData storage vData = libraries[libraryName].versions[version];
        return (vData.ipfsHash, vData.publisher, vData.timestamp, vData.deprecated, vData.dependencies);
    }

    function getVersionNumbers(
        string calldata libraryName
    ) public view libraryMustExist(libraryName) returns (string[] memory) {
        return libraries[libraryName].versionNumbers;
    }

    function getAllLibraryNames() public view returns (string[] memory) {
        return libraryNames;
    }
}