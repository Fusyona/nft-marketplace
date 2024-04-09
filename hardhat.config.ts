import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "solidity-coverage";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-etherscan";
import dotenv from "dotenv";
dotenv.config();

const { ACCOUNT, PRIVATE_KEY, INFURA_API_KEY, MUMBAI_SCAN_KEY } = process.env;

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    namedAccounts: {
        deployer: {
            default: ACCOUNT
                ? ACCOUNT
                : "0x16c7C5849A6769d58F9df6A26960F3293EF379e0",
            hardhat: 0,
            localhost: 0,
        },
        someOtherAccount: 1,
        seller: 2,
        buyer: {
            default: 3,
            nebulaTestnet: 0,
            "taraxa-testnet": 0,
        },
        creator: 4,
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        mumbai: {
            chainId: 80001,
            url: `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`,
            accounts: [PRIVATE_KEY!],
        },
        taraxa: {
            url: "https://rpc.mainnet.taraxa.io/",
            chainId: 841,
            accounts: [PRIVATE_KEY!],
        },

        nebula: {
            chainId: 1482601649,
            url: "https://mainnet.skalenodes.com/v1/green-giddy-denebola",
            accounts: [PRIVATE_KEY!],
        },
        "taraxa-testnet": {
            url: "https://rpc.testnet.taraxa.io/",
            chainId: 842,
            accounts: [PRIVATE_KEY!],
        },
        nebulaTestnet: {
            chainId: 37084624,
            url: "https://testnet.skalenodes.com/v1/lanky-ill-funny-testnet",
            accounts: [PRIVATE_KEY!],
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
    etherscan: {
        apiKey: {
            nebula: MUMBAI_SCAN_KEY!,
        },
        customChains: [
            {
                network: "taraxa",
                chainId: 841,
                urls: {
                    apiURL: "https://explorer.mainnet.taraxa.io/api",
                    browserURL: "https://explorer.mainnet.taraxa.io/",
                },
            },
            {
                network: "nebula",
                chainId: 1482601649,
                urls: {
                    apiURL: "https://green-giddy-denebola.explorer.mainnet.skalenodes.com/api",
                    browserURL:
                        "https://green-giddy-denebola.explorer.mainnet.skalenodes.com/",
                },
            },

            {
                network: "taraxa-testnet",
                chainId: 842,
                urls: {
                    apiURL: "https://explorer.testnet.taraxa.io/api",
                    browserURL: "https://explorer.testnet.taraxa.io/",
                },
            },
            {
                network: "nebulaTestnet",
                chainId: 37084624,
                urls: {
                    apiURL: "https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/api",
                    browserURL:
                        "https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com/",
                },
            },
        ],
    },
};

export default config;
