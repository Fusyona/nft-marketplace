import { network } from "hardhat";
import { Address } from "hardhat-deploy/types";

export interface NetworkConfigItem {
    blockConfirmations?: number;
    paymentTokenAddress?: Address;
    erc20MarketplaceAddress?: Address;
}

export interface NetworkConfigInfo {
    [key: string]: NetworkConfigItem;
}

export function isDevelopmentNetwork() {
    const developmentNetworks = ["hardhat", "localhost"];
    return developmentNetworks.includes(network.name);
}

export function getFromNetworkConfig<K extends keyof NetworkConfigItem>(
    key: K
) {
    return networkConfig[network.name]?.[key];
}

const networkConfig: NetworkConfigInfo = {
    localhost: {},
    hardhat: {},
    nebula: {
        paymentTokenAddress: "0xCC205196288B7A26f6D43bBD68AaA98dde97276d",
    },
    nebulaTestnet: {
        paymentTokenAddress: "0xF72B75f805BD5C3997202f23349A4C9Dc8c79de1",
        erc20MarketplaceAddress: "0xEb257B3b3f1fFcc3497C0324d0608335347e63e6",
    },
    mumbai: {
        paymentTokenAddress: "0xBd5770d8647bd365b3D4EE0D7c5732c43a41C238",
    },
    "taraxa-testnet": {
        paymentTokenAddress: "0x904dF3e5787580e32e61170eB695A94Cf7379E63",
    },
};
