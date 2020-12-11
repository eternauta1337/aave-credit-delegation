require('dotenv').config();
require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.7.3",
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_PROVIDER,
        // blockNumber: 11409188 // Uncomment for faster development
      }
    },
    local: {
      url: 'http://localhost:8545'
    },
  },
  mocha: {
    timeout: 600000
  }
};

