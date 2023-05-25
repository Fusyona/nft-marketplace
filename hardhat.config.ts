import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    namedAccounts: {
        deployer: 0,
    },
    networks: {
        hardhat: {},
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: "2ddf7536-429c-4bc3-8558-e4cb64d63b58",
        token: "MATIC",
        gasPriceApi: "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice"
    },
};

export default config;
