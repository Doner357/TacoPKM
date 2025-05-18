// contracts/LibraryRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Keep version consistent

import "@openzeppelin/contracts/access/Ownable.sol";

contract LibraryRegistry is Ownable {

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
        mapping(string => VersionData) versions;
        mapping(address => bool) authorizedUsers;
        string[] versionNumbers;
    }

    // --- State Variables ---
    mapping(string => Library) private libraries;
    string[] private libraryNames;
    mapping(string => bool) private libraryExists;

    // --- Events ---
    event LibraryRegistered(
        string indexed name,
        address indexed owner,
        bool isPrivate,
        string language
    );
    // Other events remain unchanged
    event VersionPublished(string indexed libraryName, string version, string ipfsHash, address indexed publisher);
    event VersionDeprecated(string indexed libraryName, string version);
    event AuthorizationGranted(string indexed libraryName, address indexed user);
    event AuthorizationRevoked(string indexed libraryName, address indexed user);
    event LibraryDeleted(string indexed name);


    // --- Modifiers ---
    // Modifiers remain unchanged
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
        require(bytes(libraries[libraryName].versions[version].ipfsHash).length != 0, "LibraryRegistry: Version does not exist");
        _;
    }


    // --- Constructor ---
    // Constructor remains unchanged
    constructor() Ownable(msg.sender) {}

    // --- Core Functions ---

    /**
     * @notice Registers a new library
     * @param name Unique name of the library
     * @param description Library description
     * @param tags Relevant tags
     * @param isPrivate Whether the library is private
     * @param _language The primary programming language <<< ADDED PARAMETER
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

        libraryExists[name] = true;
        libraryNames.push(name);

        emit LibraryRegistered(name, msg.sender, isPrivate, _language);
    }

    // publishVersion and deprecateVersion remain unchanged as language is per-library

    function publishVersion(
        string calldata libraryName,
        string calldata version,
        string calldata ipfsHash,
        Dependency[] calldata _dependencies
    ) external onlyLibraryOwner(libraryName) {
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
    ) external onlyLibraryOwner(libraryName) versionMustExist(libraryName, version) {
        libraries[libraryName].versions[version].deprecated = true;
        emit VersionDeprecated(libraryName, version);
    }

    /**
     * @notice Deletes a registered library IF no versions have been published.
     * @dev Only the library owner can call this.
     * @param name The name of the library to delete.
     */
    function deleteLibrary(string calldata name) external onlyLibraryOwner(name) libraryMustExist(name) {
        Library storage lib = libraries[name];

        require(lib.versionNumbers.length == 0, "LibraryRegistry: Cannot delete library with published versions.");

        delete libraryExists[name];
        delete libraries[name];

        for (uint i = 0; i < libraryNames.length; i++) {
            if (keccak256(abi.encodePacked(libraryNames[i])) == keccak256(abi.encodePacked(name))) {
                libraryNames[i] = libraryNames[libraryNames.length - 1];
                libraryNames.pop();
                break;
            }
        }

        emit LibraryDeleted(name);
    }


    // --- Permission Management ---
    // authorizeUser and revokeAuthorization remain unchanged

    function authorizeUser(
        string calldata libraryName,
        address userAddress
    ) external onlyLibraryOwner(libraryName) libraryMustExist(libraryName) {
        require(libraries[libraryName].isPrivate, "LibraryRegistry: Library is not private");
        require(userAddress != address(0), "LibraryRegistry: Invalid user address");
        libraries[libraryName].authorizedUsers[userAddress] = true;
        emit AuthorizationGranted(libraryName, userAddress);
    }

    function revokeAuthorization(
        string calldata libraryName,
        address userAddress
    ) external onlyLibraryOwner(libraryName) libraryMustExist(libraryName) {
         require(libraries[libraryName].isPrivate, "LibraryRegistry: Library is not private");
        delete libraries[libraryName].authorizedUsers[userAddress];
        emit AuthorizationRevoked(libraryName, userAddress);
    }


    // --- Query Functions ---

    // hasAccess remains unchanged
     function hasAccess(
        string calldata libraryName,
        address userAddress
    ) public view libraryMustExist(libraryName) returns (bool) {
        Library storage lib = libraries[libraryName];
        if (!lib.isPrivate) {
            return true;
        }
        return lib.owner == userAddress || lib.authorizedUsers[userAddress];
    }


    /**
     * @notice Gets basic information about a library
     * @return owner The owner's address
     * @return description The library description
     * @return tags Associated tags
     * @return isPrivate Whether the library is private
     * @return language The primary programming language <<< ADDED RETURN VALUE
     */
    function getLibraryInfo(
        string calldata libraryName
    ) public view libraryMustExist(libraryName) returns (
        address owner,
        string memory description,
        string[] memory tags,
        bool isPrivate,
        string memory language
    ) {
        Library storage lib = libraries[libraryName];
        return (
            lib.owner,
            lib.description,
            lib.tags,
            lib.isPrivate,
            lib.language
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