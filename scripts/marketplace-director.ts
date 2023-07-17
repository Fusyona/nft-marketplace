import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import MarketplaceBuilder from "./marketplace-builder";
import { web3 } from "hardhat";
const {
    abi: IMARKETPLACE_ABI,
} = require("../artifacts/contracts/IMarketplace.sol/IMarketplace.json");

export default class MarketplaceDirector {
    static hardhatConfig(builder: MarketplaceBuilder) {
        builder
            .withProvider(
                web3.currentProvider as ExternalProvider | JsonRpcFetchFunc
            )
            .withContractAbi(IMARKETPLACE_ABI);
    }
}
