// ignition/modules/Deploy.js
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LibraryRegistryModule", (m) => {
  // m means ModuleBuilder

  console.log("Defining deployment for LibraryRegistry...");
  const libraryRegistry = m.contract("LibraryRegistry", []);
  console.log("LibraryRegistry deployment defined.");

  return { libraryRegistry };
});