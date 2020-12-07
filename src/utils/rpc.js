const hre = require('hardhat');

const impersonateAddress = async (address) => {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });

  const signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;

  return signer;
};

const takeSnapshot = async () => {
  return await hre.network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
};

const restoreSnapshot = async (id) => {
  await hre.network.provider.request({
    method: 'evm_revert',
    params: [id],
  });
};

module.exports = {
  impersonateAddress,
  takeSnapshot,
  restoreSnapshot,
};
