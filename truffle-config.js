require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    sepolia: {
      provider: () => new HDWalletProvider({
        mnemonic: {
          phrase: process.env.MNEMONIC
        },
        providerOrUrl: `wss://sepolia.infura.io/ws/v3/${process.env.INFURA_API_KEY}`,
        networkCheckTimeout: 10000000,
        timeoutBlocks: 200,
        pollingInterval: 12000
      }),
      network_id: "*",
      gas: 4000000,
      confirmations: 0,
      timeoutBlocks: 200,
      skipDryRun: true
    }
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
