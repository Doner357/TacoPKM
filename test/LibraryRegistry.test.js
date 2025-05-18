// test/LibraryRegistry.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat"); // Import ethers from Hardhat Runtime Environment

// Helper to parse Ether or Gwei into Wei
const parseUnits = ethers.parseUnits;

describe("LibraryRegistry Contract", function () {
    let LibraryRegistry;    // Contract Factory
    let libraryRegistry;    // Deployed contract instance for 'owner'
    let owner;              // Signer object for the contract deployer/owner
    let addr1;              // Signer object for another user
    let addr2;              // Signer object for a third user

    // --- Globally Defined Constants for Tests ---
    const libName = "TestLib"; // General purpose public lib, non-licensed by default
    const libDesc = "A library for testing general features";
    const libTags = ["test", "example"];
    const libLang = "javascript";
    const libLangCpp = "c++";

    const version1 = "1.0.0";
    const ipfsHash1 = "QmTestHashForGeneralLibV1";
    const version2 = "1.1.0"; // For multiple version tests
    const ipfsHash2 = "QmTestHashForGeneralLibV2";

    const emptyDeps = []; // Empty dependencies array

    // Names for permission testing (will be registered as needed in their specific suites)
    const publicPermLibName = "PublicPermissionTestLib";
    const privatePermLibName = "PrivatePermissionTestLib";

    // Constants for licensing tests
    const licensedPublicLibName = "PremiumPublicLicensedLib"; // Explicitly public and will be set to require a license
    const licensedLibDesc = "A library requiring a license";
    const licensedLibLangSol = "solidity";
    const licenseFeeEth = "0.01"; // Example fee in ETH string
    let licenseFeeWei;

    // Constants for deletion tests
    const libToDeleteNoVer = "ToDeleteLibNoVersions";
    const libToDeleteWithVer = "ToDeleteLibWithVersions";
    const versionForDeleteTest = "1.0.0";
    const ipfsHashForDeleteTest = "QmHashForDeleteTestLib";
    // --- End of Globally Defined Constants ---

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy a new LibraryRegistry contract before each test
        LibraryRegistry = await ethers.getContractFactory("LibraryRegistry");
        libraryRegistry = await LibraryRegistry.deploy();
        // await libraryRegistry.waitForDeployment(); // waitForDeployment is deprecated

        // Calculate Wei value for license fee
        licenseFeeWei = parseUnits(licenseFeeEth, "ether");

        // NOTE: No global library registrations here anymore to ensure test isolation.
        // Each main `describe` block will handle its own necessary base registrations.
    });

    describe("Deployment", function () {
        it("Should set the deployer as the initial owner", async function () {
            expect(await libraryRegistry.owner()).to.equal(owner.address);
        });
    });

    describe("Library Registration", function () {
        it("Should register a public library successfully with all details", async function () {
            const newPublicLib = "NewPublicLibForRegTest"; // Use a fresh name for this test
            await expect(libraryRegistry.registerLibrary(newPublicLib, libDesc, libTags, false, libLang))
                .to.emit(libraryRegistry, "LibraryRegistered")
                .withArgs(newPublicLib, owner.address, false, libLang);

            const info = await libraryRegistry.getLibraryInfo(newPublicLib);
            expect(info.owner).to.equal(owner.address);
            expect(info.description).to.equal(libDesc);
            expect(info.tags).to.deep.equal(libTags);
            expect(info.isPrivate).to.be.false;
            expect(info.language).to.equal(libLang);
            expect(info.licenseFee).to.equal(0);
            expect(info.licenseRequired).to.be.false;
            expect(await libraryRegistry.getAllLibraryNames()).to.include(newPublicLib);
        });

        it("Should register a private library successfully", async function () {
            const newPrivateLib = "NewPrivateLibForRegTest"; // Use a fresh name
            await expect(libraryRegistry.registerLibrary(newPrivateLib, "A private one", [], true, libLangCpp))
                .to.emit(libraryRegistry, "LibraryRegistered")
                .withArgs(newPrivateLib, owner.address, true, libLangCpp);
            const info = await libraryRegistry.getLibraryInfo(newPrivateLib);
            expect(info.isPrivate).to.be.true;
            expect(info.language).to.equal(libLangCpp);
        });

        it("Should fail if registering an existing library name", async function () {
            const existingLibName = "ExistingLibForConflictTest";
            await libraryRegistry.registerLibrary(existingLibName, libDesc, libTags, false, libLang);
            await expect(libraryRegistry.registerLibrary(existingLibName, "New desc", [], false, "rust"))
                .to.be.revertedWith("LibraryRegistry: Library name already exists");
        });
    });

    describe("Version Publishing", function () {
        const pubLibName = "PublishTestLib";
        beforeEach(async function() {
            await libraryRegistry.registerLibrary(pubLibName, "Lib for publishing tests", [], false, "go");
        });

        it("Should allow the owner to publish a version successfully", async function () {
            await expect(libraryRegistry.publishVersion(pubLibName, version1, ipfsHash1, emptyDeps))
                .to.emit(libraryRegistry, "VersionPublished")
                .withArgs(pubLibName, version1, ipfsHash1, owner.address);
            const vInfo = await libraryRegistry.getVersionInfo(pubLibName, version1);
            expect(vInfo.ipfsHash).to.equal(ipfsHash1);
            expect(vInfo.publisher).to.equal(owner.address);
            expect(vInfo.timestamp).to.be.gt(0);
            expect(vInfo.deprecated).to.be.false;
            expect(vInfo.dependencies).to.deep.equal(emptyDeps);
            expect(await libraryRegistry.getVersionNumbers(pubLibName)).to.deep.equal([version1]);
        });
        // ... other Version Publishing tests ...
        it("Should prevent non-owners from publishing a version", async function () {
            await expect(libraryRegistry.connect(addr1).publishVersion(pubLibName, version1, ipfsHash1, emptyDeps))
                .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
        });
        it("Should prevent publishing if library does not exist", async function () {
            await expect(libraryRegistry.publishVersion("NonExistentPublishLib", version1, ipfsHash1, emptyDeps))
                .to.be.revertedWith("LibraryRegistry: Library does not exist");
        });
        it("Should prevent publishing a version that already exists", async function () {
            await libraryRegistry.publishVersion(pubLibName, version1, ipfsHash1, emptyDeps);
            await expect(libraryRegistry.publishVersion(pubLibName, version1, "DifferentHash", emptyDeps))
                .to.be.revertedWith("LibraryRegistry: Version already exists");
        });
        it("Should prevent publishing with an empty IPFS hash", async function () {
            await expect(libraryRegistry.publishVersion(pubLibName, version1, "", emptyDeps))
                .to.be.revertedWith("LibraryRegistry: IPFS hash cannot be empty");
        });
        it("Should allow publishing multiple different versions", async function () {
            await libraryRegistry.publishVersion(pubLibName, version1, ipfsHash1, emptyDeps);
            await libraryRegistry.publishVersion(pubLibName, version2, ipfsHash2, emptyDeps);
            expect(await libraryRegistry.getVersionNumbers(pubLibName)).to.deep.equal([version1, version2]);
            const v2Info = await libraryRegistry.getVersionInfo(pubLibName, version2);
            expect(v2Info.ipfsHash).to.equal(ipfsHash2);
        });
    });

    describe("Licensing", function() {
        // Using global 'licensedPublicLibName' for these tests.
        // It will be registered as PUBLIC in this suite's beforeEach.
        beforeEach(async function() {
            await libraryRegistry.registerLibrary(licensedPublicLibName, licensedLibDesc, ["premium"], false, licensedLibLangSol);
        });

        describe("setLibraryLicense", function() {
            it("Should allow owner to set license for a PUBLIC library", async function() {
                await expect(libraryRegistry.setLibraryLicense(licensedPublicLibName, licenseFeeWei, true))
                    .to.emit(libraryRegistry, "LibraryLicenseConfigSet")
                    .withArgs(licensedPublicLibName, licenseFeeWei, true);
                const info = await libraryRegistry.getLibraryInfo(licensedPublicLibName);
                expect(info.licenseFee).to.equal(licenseFeeWei);
                expect(info.licenseRequired).to.be.true;
            });

            it("Should PREVENT setting licenseRequired=true for a new PRIVATE library", async function() {
                const tempPrivateLib = "TempPrivateForSetLicenseTest";
                await libraryRegistry.registerLibrary(tempPrivateLib, "desc", [], true, "test");
                await expect(libraryRegistry.setLibraryLicense(tempPrivateLib, licenseFeeWei, true)) // Attempt to make private lib require license
                    .to.be.revertedWith("LibraryRegistry: Private libraries cannot require a license for access via purchase; use direct authorization.");
            });

            it("Should allow setting license fee (but not required=true) for a private library", async function() {
                const tempPrivateLib2 = "TempPrivateForFeeSet";
                await libraryRegistry.registerLibrary(tempPrivateLib2, "desc", [], true, "test");
                await expect(libraryRegistry.setLibraryLicense(tempPrivateLib2, licenseFeeWei, false)) // required is false
                    .to.emit(libraryRegistry, "LibraryLicenseConfigSet")
                    .withArgs(tempPrivateLib2, licenseFeeWei, false);
                const info = await libraryRegistry.getLibraryInfo(tempPrivateLib2);
                expect(info.licenseFee).to.equal(licenseFeeWei);
                expect(info.licenseRequired).to.be.false; // Must be false if private
            });

            it("Should allow owner to set a zero fee for a required (public) license", async function() {
                await expect(libraryRegistry.setLibraryLicense(licensedPublicLibName, 0, true))
                    .to.emit(libraryRegistry, "LibraryLicenseConfigSet")
                    .withArgs(licensedPublicLibName, 0, true);
            });
            it("Should prevent non-owner from setting license for public licensed lib", async function() {
                await expect(libraryRegistry.connect(addr1).setLibraryLicense(licensedPublicLibName, licenseFeeWei, true))
                    .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
            });
        });

        describe("purchaseLibraryLicense", function() {
            let contractAsAddr1;
            beforeEach(async function() {
                // licensedPublicLibName is public, set it to require a license
                await libraryRegistry.setLibraryLicense(licensedPublicLibName, licenseFeeWei, true);
                contractAsAddr1 = libraryRegistry.connect(addr1); // Simplified connection
            });

            it("Should allow a user (addr1) to purchase a license for a public-licensed library", async function() {
                const buyer = addr1;
                const ownerInitialBalance = await ethers.provider.getBalance(owner.address);
                await expect(contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: licenseFeeWei }))
                    .to.emit(libraryRegistry, "LibraryLicensePurchased")
                    .withArgs(licensedPublicLibName, buyer.address, owner.address, licenseFeeWei);
                expect(await libraryRegistry.hasUserLicense(licensedPublicLibName, buyer.address)).to.be.true;
                expect(await libraryRegistry.hasAccess(licensedPublicLibName, buyer.address)).to.be.true;
                const ownerFinalBalance = await ethers.provider.getBalance(owner.address);
                expect(ownerFinalBalance).to.equal(ownerInitialBalance + licenseFeeWei);
            });

             it("Should allow purchase with overpayment and refund for public-licensed library", async function() {
                const buyer = addr1;
                const paymentAmount = licenseFeeWei + parseUnits("0.001", "ether");
                const buyerInitialBalance = await ethers.provider.getBalance(buyer.address);
                const ownerInitialBalance = await ethers.provider.getBalance(owner.address);

                const txResponse = await contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: paymentAmount });
                const txReceipt = await txResponse.wait();

                expect(txResponse).to.emit(libraryRegistry, "LibraryLicensePurchased").withArgs(licensedPublicLibName, buyer.address, owner.address, licenseFeeWei);
                expect(await libraryRegistry.hasUserLicense(licensedPublicLibName, buyer.address)).to.be.true;

                const ownerFinalBalance = await ethers.provider.getBalance(owner.address);
                expect(ownerFinalBalance).to.equal(ownerInitialBalance + licenseFeeWei);

                const gasUsed = txReceipt.gasUsed * txReceipt.gasPrice;
                const buyerFinalBalance = await ethers.provider.getBalance(buyer.address);
                // Check buyer's balance reflects payment of fee and gas, and refund of overpayment
                expect(buyerFinalBalance).to.equal(buyerInitialBalance - (licenseFeeWei + gasUsed));
            });

            it("Should fail to purchase license for a private library (as it cannot be licenseRequired=true)", async function() {
                const tempPrivateLib = "TempPrivateForPurchaseTest";
                await libraryRegistry.registerLibrary(tempPrivateLib, "desc", [], true, "test");
                // Attempting to set it to required would fail, so its licenseRequired is false.
                // Thus, purchase should fail with "License not required".
                await expect(contractAsAddr1.purchaseLibraryLicense(tempPrivateLib, { value: licenseFeeWei }))
                    .to.be.revertedWith("LibraryRegistry: License not required for this library.");
            });
            // ... other purchaseLibraryLicense tests ...
            it("Should allow purchasing a 'free but required' public license by addr1", async function() {
                await libraryRegistry.setLibraryLicense(licensedPublicLibName, 0, true);
                await expect(contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: 0 }))
                    .to.emit(libraryRegistry, "LibraryLicensePurchased")
                    .withArgs(licensedPublicLibName, addr1.address, owner.address, 0);
            });
            it("Should fail if payment by addr1 is insufficient for public-licensed lib", async function() {
                if (licenseFeeWei == 0) this.skip(); // Use '==' for BigInt comparison with 0 or use BigInt(0)
                const insufficientPayment = licenseFeeWei - parseUnits("1", "gwei");
                if (insufficientPayment < 0) this.skip(); // Use '<' for BigInt
                await expect(contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: insufficientPayment }))
                    .to.be.revertedWith("LibraryRegistry: Insufficient Ether sent. Required exact fee or more.");
            });
            it("Should fail if public library does not require a license when addr1 purchases", async function() {
                await libraryRegistry.setLibraryLicense(licensedPublicLibName, licenseFeeWei, false);
                await expect(contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: licenseFeeWei }))
                    .to.be.revertedWith("LibraryRegistry: License not required for this library.");
            });
            it("Should fail if user addr1 already owns a license for public-licensed lib", async function() {
                await contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: licenseFeeWei });
                await expect(contractAsAddr1.purchaseLibraryLicense(licensedPublicLibName, { value: licenseFeeWei }))
                    .to.be.revertedWith("LibraryRegistry: License already owned by this address.");
            });

        });

        describe("hasAccess with new Licensing Rules", function() {
            let userWithLicense;
            let userWithoutLicense;
            // For this suite, we need:
            // 1. A public library that requires a license (licensedPublicLibName) - registered by parent suite's beforeEach
            // 2. A standard private library (privatePermLibName)
            // 3. A standard public library that does NOT require a license (publicPermLibName)

            beforeEach(async function() {
                userWithLicense = addr1;
                userWithoutLicense = addr2;

                // Ensure all necessary libraries are registered for *this instance* of libraryRegistry
                // licensedPublicLibName is already registered by the parent `Licensing` suite's beforeEach and license set.
                await libraryRegistry.setLibraryLicense(licensedPublicLibName, licenseFeeWei, true); // Ensure license is set for this test group

                // privatePermLibName (private, licenseRequired is false by default and cannot be true)
                await libraryRegistry.registerLibrary(privatePermLibName, "Global Private Desc for hasAccess suite", [], true, "solidity");

                // publicPermLibName (public, licenseRequired is false by default)
                await libraryRegistry.registerLibrary(publicPermLibName, "Global Public Desc for hasAccess suite", [], false, "any");

                // Have userWithLicense purchase the license for the public-licensed library
                const contractAsUserWithLicense = libraryRegistry.connect(userWithLicense);
                await contractAsUserWithLicense.purchaseLibraryLicense(licensedPublicLibName, { value: licenseFeeWei });
            });

            it("Owner should always have access to all their libraries", async function() {
                expect(await libraryRegistry.hasAccess(licensedPublicLibName, owner.address)).to.be.true;
                expect(await libraryRegistry.hasAccess(privatePermLibName, owner.address)).to.be.true;
                expect(await libraryRegistry.hasAccess(publicPermLibName, owner.address)).to.be.true;
            });

            it("User with license HAS access to a public-licensed library", async function() {
                expect(await libraryRegistry.hasAccess(licensedPublicLibName, userWithLicense.address)).to.be.true;
            });

            it("User without license does NOT have access to a public-licensed library", async function() {
                expect(await libraryRegistry.hasAccess(licensedPublicLibName, userWithoutLicense.address)).to.be.false;
            });

            it("User (even with a license for a public one) does NOT have access to a private library without authorization", async function() {
                expect(await libraryRegistry.hasAccess(privatePermLibName, userWithLicense.address)).to.be.false;
            });

            it("User authorized for a private library HAS access (license is not applicable for private lib access)", async function() {
                expect(await libraryRegistry.hasUserLicense(privatePermLibName, userWithoutLicense.address)).to.be.false;
                await libraryRegistry.authorizeUser(privatePermLibName, userWithoutLicense.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, userWithoutLicense.address)).to.be.true;
            });

            it("A public, non-licensed library should grant access to everyone", async function() {
                expect(await libraryRegistry.hasAccess(publicPermLibName, userWithLicense.address)).to.be.true;
                expect(await libraryRegistry.hasAccess(publicPermLibName, userWithoutLicense.address)).to.be.true;
            });
        });

        describe("getLibraryInfo with Licensing", function() {
            it("Should return correct licenseFee and licenseRequired status for public lib", async function() {
                // licensedPublicLibName is already registered by the parent `Licensing` suite's beforeEach
                await libraryRegistry.setLibraryLicense(licensedPublicLibName, licenseFeeWei, true);
                let info = await libraryRegistry.getLibraryInfo(licensedPublicLibName);
                expect(info.licenseFee).to.equal(licenseFeeWei);
                expect(info.licenseRequired).to.be.true;
            });
            it("Should show licenseRequired as false for private lib even if fee is set", async function() {
                // Use privatePermLibName as it's a defined global constant
                await libraryRegistry.registerLibrary(privatePermLibName, "desc", [], true, "sol");
                await libraryRegistry.setLibraryLicense(privatePermLibName, licenseFeeWei, false); // required must be false
                let info = await libraryRegistry.getLibraryInfo(privatePermLibName);
                expect(info.licenseFee).to.equal(licenseFeeWei);
                expect(info.licenseRequired).to.be.false;
            });
        });
    });

    describe("Permissions and Authorization", function() {
        beforeEach(async function() {
            // Register specific libraries for this test suite
            // Use publicPermLibName as it's a defined global constant
            await libraryRegistry.registerLibrary(publicPermLibName, "Global Public Desc", [], false, "any");
            await libraryRegistry.registerLibrary(privatePermLibName, "Global Private Desc", [], true, "solidity");
        });

        it("Owner should have access to their private library", async function() {
            expect(await libraryRegistry.hasAccess(privatePermLibName, owner.address)).to.be.true;
        });

        it("Other users should NOT have access to a private library initially (no license, no auth)", async function() {
            expect(await libraryRegistry.hasAccess(privatePermLibName, addr1.address)).to.be.false;
        });

        it("Any user should have access to a public, non-licensed library", async function() {
            expect(await libraryRegistry.hasAccess(publicPermLibName, addr1.address)).to.be.true;
        });

        describe("authorizeUser", function() {
            it("Should allow owner to authorize a user for a private library", async function() {
                await expect(libraryRegistry.authorizeUser(privatePermLibName, addr1.address))
                    .to.emit(libraryRegistry, "AuthorizationGranted")
                    .withArgs(privatePermLibName, addr1.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr1.address)).to.be.true;
            });
            it("Should prevent non-owner from authorizing a user", async function() {
                await expect(libraryRegistry.connect(addr1).authorizeUser(privatePermLibName, addr2.address))
                    .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
            });
            it("Should prevent authorizing a user for a public library", async function() {
                await expect(libraryRegistry.authorizeUser(publicPermLibName, addr1.address))
                    .to.be.revertedWith("LibraryRegistry: Library is not private");
            });
            it("Should prevent authorizing the zero address", async function() {
                await expect(libraryRegistry.authorizeUser(privatePermLibName, ethers.ZeroAddress))
                    .to.be.revertedWith("LibraryRegistry: Invalid user address");
            });
            it("Should allow authorizing multiple users", async function() {
                await libraryRegistry.authorizeUser(privatePermLibName, addr1.address);
                await libraryRegistry.authorizeUser(privatePermLibName, addr2.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr1.address)).to.be.true;
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr2.address)).to.be.true;
            });
            it("Should succeed even if user is already authorized", async function() {
                await libraryRegistry.authorizeUser(privatePermLibName, addr1.address);
                await expect(libraryRegistry.authorizeUser(privatePermLibName, addr1.address))
                    .to.emit(libraryRegistry, "AuthorizationGranted")
                    .withArgs(privatePermLibName, addr1.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr1.address)).to.be.true;
            });
        });
        describe("revokeAuthorization", function() {
            beforeEach(async function() {
                await libraryRegistry.authorizeUser(privatePermLibName, addr1.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr1.address)).to.be.true;
            });
            it("Should allow owner to revoke authorization", async function() {
                await expect(libraryRegistry.revokeAuthorization(privatePermLibName, addr1.address))
                    .to.emit(libraryRegistry, "AuthorizationRevoked")
                    .withArgs(privatePermLibName, addr1.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr1.address)).to.be.false;
            });
            it("Should prevent non-owner from revoking authorization", async function() {
                await expect(libraryRegistry.connect(addr2).revokeAuthorization(privatePermLibName, addr1.address))
                   .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
            });
            it("Should prevent revoking for a public library", async function() {
                await expect(libraryRegistry.revokeAuthorization(publicPermLibName, addr1.address))
                   .to.be.revertedWith("LibraryRegistry: Library is not private");
            });
            it("Should succeed even if user was not authorized (no state change, event still emits)", async function() {
                await expect(libraryRegistry.revokeAuthorization(privatePermLibName, addr2.address)) 
                    .to.emit(libraryRegistry, "AuthorizationRevoked")
                    .withArgs(privatePermLibName, addr2.address);
                expect(await libraryRegistry.hasAccess(privatePermLibName, addr2.address)).to.be.false;
            });
        });
    });

    describe("Listing Libraries", function() {
        it("Should return an empty list initially", async function() {
            expect(await libraryRegistry.getAllLibraryNames()).to.deep.equal([]);
        });
        it("Should return the list of registered library names", async function() {
            const name1 = "ListLibOne"; const name2 = "ListLibTwo";
            await libraryRegistry.registerLibrary(name1, "D1", [], false, "l1");
            await libraryRegistry.registerLibrary(name2, "D2", [], true, "l2");
            const names = await libraryRegistry.getAllLibraryNames();
            expect([...names]).to.have.deep.members([name1, name2]); // Spread to compare array contents
            expect(names.length).to.equal(2);
        });
    });

    describe("Deprecation", function() {
        const depLibName = "DeprecationTestLib"; 
        beforeEach(async function() {
            await libraryRegistry.registerLibrary(depLibName, libDesc, libTags, false, libLang);
            await libraryRegistry.publishVersion(depLibName, version1, ipfsHash1, emptyDeps);
        });
        it("Should allow owner to deprecate a version", async function() {
            await expect(libraryRegistry.deprecateVersion(depLibName, version1))
                .to.emit(libraryRegistry, "VersionDeprecated").withArgs(depLibName, version1);
            const vInfo = await libraryRegistry.getVersionInfo(depLibName, version1);
            expect(vInfo.deprecated).to.be.true;
        });
        // ... other deprecation tests
        it("Should prevent non-owners from deprecating a version", async function() {
            await expect(libraryRegistry.connect(addr1).deprecateVersion(depLibName, version1))
                .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
        });
        it("Should prevent deprecating a non-existent version", async function() {
            await expect(libraryRegistry.deprecateVersion(depLibName, "9.9.9"))
                .to.be.revertedWith("LibraryRegistry: Version does not exist");
        });
        it("Should prevent deprecating a version of a non-existent library", async function() {
            await expect(libraryRegistry.deprecateVersion("FakeLibForDep", version1))
                .to.be.revertedWith("LibraryRegistry: Library does not exist");
        });
        it("Should allow deprecating even if already deprecated", async function() {
            await libraryRegistry.deprecateVersion(depLibName, version1);
            await expect(libraryRegistry.deprecateVersion(depLibName, version1))
                .to.emit(libraryRegistry, "VersionDeprecated").withArgs(depLibName, version1);
            const vInfo = await libraryRegistry.getVersionInfo(depLibName, version1);
            expect(vInfo.deprecated).to.be.true;
        });
    });

    describe("Library Deletion", function() {
        beforeEach(async function() {
            await libraryRegistry.registerLibrary(libToDeleteNoVer, "To be deleted", [], false, "testlang");
            await libraryRegistry.registerLibrary(libToDeleteWithVer, "Has versions", [], false, "testlang");
            await libraryRegistry.publishVersion(libToDeleteWithVer, versionForDeleteTest, ipfsHashForDeleteTest, []);
        });
        it("Should allow the owner to delete a library with no published versions", async function() {
            const initialNames = await libraryRegistry.getAllLibraryNames();
            expect(initialNames).to.include(libToDeleteNoVer);
            await expect(libraryRegistry.deleteLibrary(libToDeleteNoVer))
                .to.emit(libraryRegistry, "LibraryDeleted").withArgs(libToDeleteNoVer);
            const finalNames = await libraryRegistry.getAllLibraryNames();
            expect(finalNames).to.not.include(libToDeleteNoVer);
            expect(finalNames.length).to.equal(initialNames.length - 1);
            await expect(libraryRegistry.getLibraryInfo(libToDeleteNoVer))
                .to.be.revertedWith("LibraryRegistry: Library does not exist");
        });
        // ... other deletion tests
        it("Should prevent deleting a library that has published versions", async function() {
            await expect(libraryRegistry.deleteLibrary(libToDeleteWithVer))
                .to.be.revertedWith("LibraryRegistry: Cannot delete library with published versions.");
        });
        it("Should prevent non-owners from deleting a library", async function() {
            await expect(libraryRegistry.connect(addr1).deleteLibrary(libToDeleteNoVer))
               .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
        });
        it("Should prevent deleting a non-existent library", async function() {
            await expect(libraryRegistry.deleteLibrary("NonExistentDeletionLib"))
               .to.be.revertedWith("LibraryRegistry: Library does not exist");
        });
        it("Deleting one library should not affect others", async function() {
            const initialNames = await libraryRegistry.getAllLibraryNames();
            await libraryRegistry.deleteLibrary(libToDeleteNoVer);
            const finalNames = await libraryRegistry.getAllLibraryNames();
            expect(finalNames).to.include(libToDeleteWithVer); // This library should still exist
            expect(initialNames.includes(libToDeleteWithVer)).to.be.true; // Ensure it was there initially
            expect(finalNames.length).to.equal(initialNames.length - 1);
        });
    });
});