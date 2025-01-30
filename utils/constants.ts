import { Signer } from "ethers";
import { Address } from "hardhat-deploy/types";

export const contractNames = {
    Erc20PaymentMarketplace: "Erc20PaymentMarketplace",
    FusyERC721CollectionWithRoyaltySupport:
        "FusyERC721CollectionWithRoyaltySupport",
    MockERC20: "MockERC20",
    MockERC721Collection: "MockERC721Collection",
    MockERC1155Collection: "MockERC1155Collection",
    MsgValuePaymentMarketplace: "MsgValuePaymentMarketplace",
    NebulaFaucet: "NebulaFaucet",
    NftIdRetriever: "NftIdRetriever",
    EasyToken: "EasyToken",
    MarketplaceWithoutCounterOffer: "MarketplaceWithoutCounterOffer"
};

export const deployArgs = {
    ROYALTY_FEE_NUMERATOR: 1000,
};

export type SignerWithAddress = Signer & { address: Address };
