import MarketplaceBuilder from "./marketplace-builder";
import { web3 } from "hardhat";
import Web3 from "web3";
const {
    abi: IMARKETPLACE_ABI,
} = require("../artifacts/contracts/IMarketplace.sol/IMarketplace.json");

export default class MarketplaceDirector {
    static hardhatConfig(builder: MarketplaceBuilder) {
        builder
            .withWeb3(web3 as unknown as Web3)
            .withContractAbi(IMARKETPLACE_ABI);
    }
}
