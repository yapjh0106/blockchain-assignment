const UserRegistry = artifacts.require("UserRegistry");
const CarrierReputationToken = artifacts.require(
  "CarrierReputationToken"
);
const LogisticsEscrow = artifacts.require("LogisticsEscrow");

module.exports = async function (deployer) {

  // 1. Deploy UserRegistry
  await deployer.deploy(UserRegistry);
  const userRegistry = await UserRegistry.deployed();

  // 2. Deploy CarrierReputationToken
  await deployer.deploy(CarrierReputationToken);
  const reputationToken =
    await CarrierReputationToken.deployed();

  // 3. Deploy LogisticsEscrow
  await deployer.deploy(
    LogisticsEscrow,
    userRegistry.address,
    reputationToken.address
  );

  const logisticsEscrow =
    await LogisticsEscrow.deployed();

  // 4. Allow LogisticsEscrow to mint CRP
  await reputationToken.setAuthorizedMinter(
    logisticsEscrow.address
  );

  console.log(
    "UserRegistry:",
    userRegistry.address
  );

  console.log(
    "CarrierReputationToken:",
    reputationToken.address
  );

  console.log(
    "LogisticsEscrow:",
    logisticsEscrow.address
  );
};