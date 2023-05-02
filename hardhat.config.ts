import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  namedAccounts: {
    deployer: 0
  },
  networks: {
    hardhat:{}
  }
}

export default config;