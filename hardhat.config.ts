import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "solidity-coverage";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import dotenv from "dotenv";
dotenv.config();

const { PRIVATE_KEY, INFURA_API_KEY } = process.env;

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    namedAccounts: {
        deployer: 0,
        creator: 1,
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        mumbai: {
            chainId: 80001,
            url: `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [process.env.PRIVATE_KEY!]
        },
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: "2ddf7536-429c-4bc3-8558-e4cb64d63b58",
        token: "MATIC",
        gasPriceApi:
            "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice",
    },
};

export default config;
