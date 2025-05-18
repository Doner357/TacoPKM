// test/LibraryRegistry.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat"); // 從 Hardhat 運行環境導入 ethers

// 使用 describe 來組織測試套件
describe("LibraryRegistry Contract", function () {
    // 聲明測試中會用到的變量
    let LibraryRegistry;
    let libraryRegistry;
    let owner;
    let addr1;
    let addr2;
    const libName = "TestLib";
    const libDesc = "A library for testing";
    const libTags = ["test", "example"];
    const libLang = "javascript";
    const libLangCpp = "c++";
    const version1 = "1.0.0";
    const ipfsHash1 = "QmTestHash1";
    const version2 = "1.1.0";
    const ipfsHash2 = "QmTestHash2";
    const emptyDeps = [];
    const privateLibName = "PrivateLib";
    const publicLibName = "PublicLib";
    const libToDelete = "ToDeleteLib";
    const libWithVersion = "LibWithVersion";
    const versionToDelete = "1.0.0";
    const hashToDelete = "QmDeleteHash";

    // beforeEach 會在每個 "it" 測試用例運行之前執行
    beforeEach(async function () {
        // 1. 獲取測試帳戶 (Signers)
        [owner, addr1, addr2] = await ethers.getSigners();

        // 2. 獲取合約工廠
        // "LibraryRegistry" 必須與您 contracts/ 目錄下的合約名稱完全一致
        LibraryRegistry = await ethers.getContractFactory("LibraryRegistry");

        // 3. 部署一個全新的合約實例
        // 由於我們的合約 constructor() Ownable(msg.sender)，部署者 owner 自動成為擁有者
        libraryRegistry = await LibraryRegistry.deploy();
        // 在較新的 Hardhat Ethers v6+ 中，等待部署確認可能需要:
        // await libraryRegistry.waitForDeployment();
        // 但在 Hardhat Network 上測試時，通常 await deploy() 就足夠了
    });

    // --- 測試套件：部署 ---
    describe("Deployment", function () {
        it("Should set the deployer as the initial owner", async function () {
            // 驗證合約的 owner() 方法返回的是部署者的地址
            expect(await libraryRegistry.owner()).to.equal(owner.address);
        });
    });

    // --- 測試套件：函式庫註冊 ---
    describe("Library Registration", function () {
        it("Should register a public library successfully", async function () {
            // 執行註冊交易，並期望它觸發 LibraryRegistered 事件，且事件參數符合預期
            await expect(libraryRegistry.registerLibrary(libName, libDesc, libTags, false, libLang))
                .to.emit(libraryRegistry, "LibraryRegistered") // 檢查事件名稱
                .withArgs(libName, owner.address, false, libLang); // 檢查事件參數

            // 調用 getLibraryInfo 驗證鏈上存儲的信息是否正確
            const info = await libraryRegistry.getLibraryInfo(libName);
            expect(info.owner).to.equal(owner.address);
            expect(info.description).to.equal(libDesc);
            expect(info.tags).to.deep.equal(libTags); // 比較數組內容需要用 deep.equal
            expect(info.isPrivate).to.be.false;
            expect(info.language).to.equal(libLang);

            // 驗證庫名列表是否更新
            expect(await libraryRegistry.getAllLibraryNames()).to.deep.equal([libName]);
        });

        it("Should register a private library successfully", async function () {
            await expect(libraryRegistry.registerLibrary(libName, libDesc, libTags, true, libLangCpp))
                .to.emit(libraryRegistry, "LibraryRegistered")
                .withArgs(libName, owner.address, true, libLangCpp);

            const info = await libraryRegistry.getLibraryInfo(libName);
            expect(info.isPrivate).to.be.true;
            expect(info.language).to.equal(libLangCpp);
        });

        it("Should fail if registering an existing library name", async function () {
            // 先成功註冊一次
            await libraryRegistry.registerLibrary(libName, libDesc, libTags, false, libLang);

            // 嘗試使用相同的名稱再次註冊，期望交易被 revert，並帶有指定的錯誤信息
            await expect(libraryRegistry.registerLibrary(libName, "Different Desc", [], false, "rust"))
                .to.be.revertedWith("LibraryRegistry: Library name already exists");
        });

        // 可以添加更多測試，例如 name 為空字符串等邊界情況
    });

    // --- 測試套件：版本發布 ---
    describe("Version Publishing", function () {
        // 在這個 describe 塊的所有測試之前，先註冊一個庫
        beforeEach(async function() {
             await libraryRegistry.registerLibrary(libName, libDesc, libTags, false, libLang);
        });

        it("Should allow the owner to publish a version successfully", async function () {
             // 執行發布交易，並期望觸發 VersionPublished 事件
             await expect(libraryRegistry.publishVersion(libName, version1, ipfsHash1, emptyDeps))
                .to.emit(libraryRegistry, "VersionPublished")
                .withArgs(libName, version1, ipfsHash1, owner.address); // 檢查事件參數

            // 驗證版本信息是否正確存儲
            // getVersionInfo 返回: [ipfsHash, publisher, timestamp, deprecated, dependencies]
            const vInfo = await libraryRegistry.getVersionInfo(libName, version1);
            expect(vInfo[0]).to.equal(ipfsHash1);        // ipfsHash
            expect(vInfo[1]).to.equal(owner.address);   // publisher
            expect(vInfo[2]).to.be.gt(0);               // timestamp 應該大於 0
            expect(vInfo[3]).to.be.false;               // deprecated 應為 false
            expect(vInfo[4]).to.deep.equal(emptyDeps);  // dependencies 應為空數組

            // 驗證版本號列表
            expect(await libraryRegistry.getVersionNumbers(libName)).to.deep.equal([version1]);
        });

        it("Should prevent non-owners from publishing a version", async function () {
            // 使用 addr1 的簽名者連接合約實例，嘗試調用 publishVersion
            await expect(libraryRegistry.connect(addr1).publishVersion(libName, version1, ipfsHash1, emptyDeps))
                .to.be.revertedWith("LibraryRegistry: Caller is not the owner"); // 期望被 revert
        });

         it("Should prevent publishing if library does not exist", async function () {
            await expect(libraryRegistry.publishVersion("NonExistentLib", version1, ipfsHash1, emptyDeps))
                .to.be.revertedWith("LibraryRegistry: Library does not exist"); // 期望庫不存在的 revert
         });

        it("Should prevent publishing a version that already exists", async function () {
            // 先成功發布一次 version1
            await libraryRegistry.publishVersion(libName, version1, ipfsHash1, emptyDeps);

            // 嘗試再次發布相同的 version1 (即使 hash 不同)
            await expect(libraryRegistry.publishVersion(libName, version1, "DifferentHash", emptyDeps))
                .to.be.revertedWith("LibraryRegistry: Version already exists"); // 期望版本已存在的 revert
        });

         it("Should prevent publishing with an empty IPFS hash", async function () {
            await expect(libraryRegistry.publishVersion(libName, version1, "", emptyDeps)) // IPFS Hash 為空字符串
                .to.be.revertedWith("LibraryRegistry: IPFS hash cannot be empty"); // 期望 hash 為空的 revert
         });

         it("Should allow publishing multiple different versions", async function () {
             // 發布兩個不同版本
             await libraryRegistry.publishVersion(libName, version1, ipfsHash1, emptyDeps);
             await libraryRegistry.publishVersion(libName, version2, ipfsHash2, emptyDeps);

             // 驗證版本號列表
             expect(await libraryRegistry.getVersionNumbers(libName)).to.deep.equal([version1, version2]);

             // 驗證第二個版本的信息
             const v2Info = await libraryRegistry.getVersionInfo(libName, version2);
             expect(v2Info[0]).to.equal(ipfsHash2); // 檢查 IPFS Hash
         });

         // 可以添加對 dependencies 參數的測試 (當您實現依賴處理後)
    });

    // --- 測試套件：權限 (基礎) ---
    describe("Permissions (Basic Access Control)", function() {
         // 在這個 describe 塊的所有測試之前，註冊一個私有庫
         const privateLibName = "PrivateLib";
         beforeEach(async function() {
             await libraryRegistry.registerLibrary(privateLibName, "Private Desc", [], true, "solidity");
         });

         it("Owner should have access to their private library", async function() {
             // 驗證 owner 調用 hasAccess 返回 true
             expect(await libraryRegistry.hasAccess(privateLibName, owner.address)).to.be.true;
         });

         it("Other users should NOT have access to a private library initially", async function() {
             // 驗證 addr1 調用 hasAccess 返回 false
             expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.false;
         });

         it("Any user should have access to a public library", async function() {
            // 先註冊一個公共庫
            await libraryRegistry.registerLibrary(libName, libDesc, [], false, libLang);
            // 驗證 addr1 對公共庫調用 hasAccess 返回 true
            expect(await libraryRegistry.hasAccess(libName, addr1.address)).to.be.true;
         });

         // 針對 authorizeUser 和 revokeAuthorization 的測試可以後續添加在這裡
         // 例如：測試 owner 可以授權 addr1，然後 addr1 的 hasAccess 變為 true
         // 再測試 owner 可以撤銷 addr1 的授權，然後 addr1 的 hasAccess 變回 false
         // 還要測試非 owner 無法執行授權/撤銷，以及不能對 public 庫進行授權等
    });

    // 測試 getAllLibraryNames
    describe("Listing Libraries", function() {
        it("Should return an empty list initially", async function() {
            expect(await libraryRegistry.getAllLibraryNames()).to.deep.equal([]);
        });

        it("Should return the list of registered library names", async function() {
            const name1 = "LibAlpha";
            const name2 = "LibBeta";
            await libraryRegistry.registerLibrary(name1, "Desc A", [], false, "langA");
            await libraryRegistry.registerLibrary(name2, "Desc B", ["tagB"], true, "langB");
            const registeredNames = await libraryRegistry.getAllLibraryNames(); // 先獲取結果
            expect([...registeredNames]).to.have.deep.members([name1, name2]);
            expect(registeredNames.length).to.equal(2);
            expect((await libraryRegistry.getAllLibraryNames()).length).to.equal(2);
        });
    });

    // 測試 Deprecation
    describe("Deprecation", function() {
        // 先註冊並發布一個版本
         beforeEach(async function() {
             await libraryRegistry.registerLibrary(libName, libDesc, libTags, false, libLang);
             await libraryRegistry.publishVersion(libName, version1, ipfsHash1, emptyDeps);
         });

        it("Should allow the owner to deprecate a version", async function() {
            // 執行 deprecate 交易，並檢查事件
            await expect(libraryRegistry.deprecateVersion(libName, version1))
                .to.emit(libraryRegistry, "VersionDeprecated")
                .withArgs(libName, version1);

            // 檢查 getVersionInfo 返回的 deprecated 標誌是否為 true
            const vInfo = await libraryRegistry.getVersionInfo(libName, version1);
            expect(vInfo[3]).to.be.true; // index 3 is 'deprecated'
        });

        it("Should prevent non-owners from deprecating a version", async function() {
            await expect(libraryRegistry.connect(addr1).deprecateVersion(libName, version1))
                .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
        });

        it("Should prevent deprecating a non-existent version", async function() {
            await expect(libraryRegistry.deprecateVersion(libName, "9.9.9"))
                .to.be.revertedWith("LibraryRegistry: Version does not exist");
        });

         it("Should prevent deprecating a version of a non-existent library", async function() {
            await expect(libraryRegistry.deprecateVersion("FakeLib", version1))
                .to.be.revertedWith("LibraryRegistry: Library does not exist");
         });

         it("Should allow deprecating even if already deprecated", async function() {
             // 第一次棄用
             await libraryRegistry.deprecateVersion(libName, version1);
             // 再次棄用，不應該報錯
             await expect(libraryRegistry.deprecateVersion(libName, version1))
                .to.emit(libraryRegistry, "VersionDeprecated") // 仍然會觸發事件
                .withArgs(libName, version1);

             const vInfo = await libraryRegistry.getVersionInfo(libName, version1);
             expect(vInfo[3]).to.be.true; // 狀態仍然是 true
         });
    });


    // --- 測試套件：權限與授權 ---
    describe("Permissions and Authorization", function() {
        
        beforeEach(async function() {
            // 在這裡註冊權限測試所需的庫
            await libraryRegistry.registerLibrary(publicLibName, "Public Desc", [], false, "any");
            await libraryRegistry.registerLibrary(privateLibName, "Private Desc", [], true, "solidity");
        });

        // Basic access tests (already existed, slightly adjusted context)
        it("Owner should have access to their private library", async function() {
            expect(await libraryRegistry.hasAccess(privateLibName, owner.address)).to.be.true;
        });

        it("Other users should NOT have access to a private library initially", async function() {
            expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.false;
        });

        it("Any user should have access to a public library", async function() {
            expect(await libraryRegistry.hasAccess(publicLibName, addr1.address)).to.be.true;
            expect(await libraryRegistry.hasAccess(publicLibName, owner.address)).to.be.true;
        });

        // --- authorizeUser Tests ---
        describe("authorizeUser", function() {
            it("Should allow owner to authorize a user for a private library", async function() {
                // 執行授權交易，檢查事件
                await expect(libraryRegistry.authorizeUser(privateLibName, addr1.address))
                    .to.emit(libraryRegistry, "AuthorizationGranted")
                    .withArgs(privateLibName, addr1.address);

                // 驗證 addr1 現在有了訪問權限
                expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.true;
            });

            it("Should prevent non-owner from authorizing a user", async function() {
                // addr1 嘗試授權 addr2
                await expect(libraryRegistry.connect(addr1).authorizeUser(privateLibName, addr2.address))
                    .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
            });

            it("Should prevent authorizing a user for a public library", async function() {
                await expect(libraryRegistry.authorizeUser(publicLibName, addr1.address))
                    .to.be.revertedWith("LibraryRegistry: Library is not private");
            });

            it("Should prevent authorizing the zero address", async function() {
                 await expect(libraryRegistry.authorizeUser(privateLibName, ethers.ZeroAddress)) // 使用 ethers.ZeroAddress
                    .to.be.revertedWith("LibraryRegistry: Invalid user address");
            });

             it("Should allow authorizing multiple users", async function() {
                await libraryRegistry.authorizeUser(privateLibName, addr1.address);
                await libraryRegistry.authorizeUser(privateLibName, addr2.address);
                expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.true;
                expect(await libraryRegistry.hasAccess(privateLibName, addr2.address)).to.be.true;
             });

             it("Should succeed even if user is already authorized", async function() {
                 await libraryRegistry.authorizeUser(privateLibName, addr1.address);
                 // 再次授權，不應報錯
                 await expect(libraryRegistry.authorizeUser(privateLibName, addr1.address))
                    .to.emit(libraryRegistry, "AuthorizationGranted") // 仍然觸發事件
                    .withArgs(privateLibName, addr1.address);
                 expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.true;
             });
        });

        // --- revokeAuthorization Tests ---
        describe("revokeAuthorization", function() {
            // 在撤銷測試前，先授權 addr1
            beforeEach(async function() {
                await libraryRegistry.authorizeUser(privateLibName, addr1.address);
                // 確認授權成功
                expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.true;
            });

            it("Should allow owner to revoke authorization for a user", async function() {
                // 執行撤銷交易，檢查事件
                await expect(libraryRegistry.revokeAuthorization(privateLibName, addr1.address))
                    .to.emit(libraryRegistry, "AuthorizationRevoked")
                    .withArgs(privateLibName, addr1.address);

                // 驗證 addr1 現在失去了訪問權限
                expect(await libraryRegistry.hasAccess(privateLibName, addr1.address)).to.be.false;
            });

            it("Should prevent non-owner from revoking authorization", async function() {
                 // addr2 嘗試撤銷 addr1 的權限
                 await expect(libraryRegistry.connect(addr2).revokeAuthorization(privateLibName, addr1.address))
                    .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
            });

            it("Should prevent revoking authorization for a public library", async function() {
                // 嘗試對公共庫執行撤銷 (雖然沒有實際授權)
                 await expect(libraryRegistry.revokeAuthorization(publicLibName, addr1.address))
                    .to.be.revertedWith("LibraryRegistry: Library is not private");
            });

             it("Should succeed even if user was not authorized", async function() {
                 // 嘗試撤銷 addr2 的權限 (addr2 從未被授權)
                 await expect(libraryRegistry.revokeAuthorization(privateLibName, addr2.address))
                    .to.emit(libraryRegistry, "AuthorizationRevoked") // 仍然觸發事件
                    .withArgs(privateLibName, addr2.address);
                 // addr2 應該仍然沒有權限
                 expect(await libraryRegistry.hasAccess(privateLibName, addr2.address)).to.be.false;
             });
        });
    });


    // Library Deletion Tests
    describe("Library Deletion", function() {
        beforeEach(async function() {
            // Register a library specifically for deletion tests
            await libraryRegistry.registerLibrary(libToDelete, "To be deleted", [], false, "testlang");
            // Register another library and publish a version to test deletion failure
            await libraryRegistry.registerLibrary(libWithVersion, "Has versions", [], false, "testlang");
            await libraryRegistry.publishVersion(libWithVersion, versionToDelete, hashToDelete, []);
        });

        it("Should allow the owner to delete a library with no published versions", async function() {
            // Verify it exists initially
            const initialNames = await libraryRegistry.getAllLibraryNames();
            expect(initialNames).to.include(libToDelete);
            await expect(libraryRegistry.getLibraryInfo(libToDelete)).to.not.be.reverted;

            // Perform deletion and check event
            await expect(libraryRegistry.deleteLibrary(libToDelete))
                .to.emit(libraryRegistry, "LibraryDeleted")
                .withArgs(libToDelete);

            // Verify it's gone
            const finalNames = await libraryRegistry.getAllLibraryNames();
            expect(finalNames).to.not.include(libToDelete);
            expect(finalNames.length).to.equal(initialNames.length - 1); // Check length decreased

            // Verify trying to get info now reverts
            await expect(libraryRegistry.getLibraryInfo(libToDelete))
                .to.be.revertedWith("LibraryRegistry: Library does not exist");

             // Verify libraryExists mapping is false (internal check, requires helper or event check)
             // We rely on getLibraryInfo revert and list change for now.
        });

         it("Should prevent deleting a library that has published versions", async function() {
            await expect(libraryRegistry.deleteLibrary(libWithVersion))
                .to.be.revertedWith("LibraryRegistry: Cannot delete library with published versions.");
         });

         it("Should prevent non-owners from deleting a library", async function() {
             await expect(libraryRegistry.connect(addr1).deleteLibrary(libToDelete))
                .to.be.revertedWith("LibraryRegistry: Caller is not the owner");
         });

          it("Should prevent deleting a non-existent library", async function() {
             await expect(libraryRegistry.deleteLibrary("NonExistentLib"))
                .to.be.revertedWith("LibraryRegistry: Library does not exist");
          });

           it("Deleting one library should not affect others", async function() {
                const initialNames = await libraryRegistry.getAllLibraryNames();
                await libraryRegistry.deleteLibrary(libToDelete);
                const finalNames = await libraryRegistry.getAllLibraryNames();
                expect(finalNames).to.include(libWithVersion); // The other library should still be there
                expect(finalNames.length).to.equal(initialNames.length - 1);
           });
    });

    // 可以在此處添加更多 describe 塊來測試其他功能，例如：
    // describe("Deprecation", function() { ... });
    // describe("Authorization", function() { ... });

});