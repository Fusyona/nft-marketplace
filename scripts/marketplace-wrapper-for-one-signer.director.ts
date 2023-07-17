import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import MarketplaceWrapperForOneSigner_Builder from "./marketplace-wrapper-for-one-signer.builder";
import { web3 } from "hardhat";
const {
    abi: IMARKETPLACE_ABI,
} = require("../artifacts/contracts/IMarketplace.sol/IMarketplace.json");

export default class MarketplaceWrapperForOneSigner_Director {
    static hardhatConfig(builder: MarketplaceWrapperForOneSigner_Builder) {
        builder
            .withProvider(
                web3.currentProvider as ExternalProvider | JsonRpcFetchFunc
            )
            .withContractAbi(IMARKETPLACE_ABI);
    }
}
