import { network } from "hardhat";
import { Address } from "hardhat-deploy/types";

export interface networkConfigItem {
    blockConfirmations?: number;
    paymentTokenAddress?: Address;
}

export interface networkConfigInfo {
    [key: string]: networkConfigItem;
}

export function isDevelopmentNetwork() {
    const developmentNetworks = ["hardhat", "localhost"];
    return developmentNetworks.includes(network.name);
}

export function getFromNetworkConfig<K extends keyof networkConfigItem>(
    key: K
) {
    return networkConfig[network.name]?.[key];
}

const networkConfig: networkConfigInfo = {
    localhost: {},
    hardhat: {},
    nebula: {
        paymentTokenAddress: "0xd392bb3254CEa5E0B30B66e345a47940690E8577",
    },
    mumbai: {
        paymentTokenAddress: "0xBd5770d8647bd365b3D4EE0D7c5732c43a41C238",
    },
};
