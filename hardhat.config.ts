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

const { PRIVATE_KEY, INFURA_API_KEY, MUMBAI_SCAN_KEY } = process.env;

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    namedAccounts: {
        deployer: 0,
        someOtherAccount: 1,
        seller: 2,
        buyer: {
            default: 3,
            nebula: 0,
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
        nebulaTestnet: {
            chainId: 503129905,
            url: "https://staging-v3.skalenodes.com/v1/staging-faint-slimy-achird",
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
                network: "nebula",
                chainId: 503129905,
                urls: {
                    apiURL: "https://staging-faint-slimy-achird.explorer.staging-v3.skalenodes.com/api",
                    browserURL:
                        "https://staging-faint-slimy-achird.explorer.staging-v3.skalenodes.com",
                },
            },
        ],
    },
};

export default config;
