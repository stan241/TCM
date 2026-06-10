import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const ISSUER_PRIVATE_KEY = process.env.ISSUER_PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000001'
const ALCHEMY_KEY        = process.env.ALCHEMY_API_KEY ?? ''

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mumbai: {
      url:      `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [ISSUER_PRIVATE_KEY],
      chainId:  80001,
      gasPrice: 'auto',
    },
    amoy: {
      url:      `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [ISSUER_PRIVATE_KEY],
      chainId:  80002,
      gasPrice: 'auto',
    },
    polygon: {
      url:      `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [ISSUER_PRIVATE_KEY],
      chainId:  137,
      gasPrice: 'auto',
    },
  },
  paths: {
    sources:  './src',
    tests:    './test',
    cache:    './cache',
    artifacts:'./artifacts',
  },
  typechain: {
    outDir: './typechain-types',
    target: 'ethers-v6',
  },
}

export default config
