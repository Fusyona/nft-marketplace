import { deployments, ethers, web3 } from "hardhat";
import { BigNumber } from "ethers";
import { Deployment } from "hardhat-deploy/types";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";

import MarketplaceWrapper from "../scripts/marketplace-wrapper";
import MsgValuePaymentMarketplaceWrapper from "../scripts/msg-value-payment-marketplace-wrapper";
import { contractNames, SignerWithAddress } from "../utils/constants";

describe("MarketplaceWithoutCounterOffer", () => {

    const MARKETPLACE_CONTRACT_NAME = contractNames.MsgValuePaymentMarketplace;
    const COLLECTION_CONTRACT_NAME = `MockERC1155Collection`;
    let signer: SignerWithAddress;
    const OWNER_SIGNER_INDEX = 0;
    let marketplaceDeployment: Deployment;
    let mockCollectionDeployment: Deployment;
    const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
    let BN = BigNumber;
    const twoUp64 = BN.from(2).pow(64);
    const _2percent = BN.from(2).mul(twoUp64).div(BN.from(100));
    const price = ethers.utils.parseEther("1")
    let marketplaceWrapper: MarketplaceWrapper;

    beforeEach(async () => {
        await deployments.fixture([
            MARKETPLACE_CONTRACT_NAME,
            COLLECTION_CONTRACT_NAME,
        ]);

        marketplaceDeployment = await deployments.get(MARKETPLACE_CONTRACT_NAME);
        mockCollectionDeployment = await deployments.get(COLLECTION_CONTRACT_NAME);

        const signers = await ethers.getSigners();
        signer = signers[OWNER_SIGNER_INDEX] as unknown as SignerWithAddress;

        marketplaceWrapper = new MsgValuePaymentMarketplaceWrapper(
            marketplaceDeployment.address,
            marketplaceDeployment.abi,
            web3.currentProvider as ExternalProvider | JsonRpcFetchFunc
        ).withSignerIndex(OWNER_SIGNER_INDEX);
    });

    it("makeCounterOffer fails when called by user", async () => {
        const counterofferPrice = price.sub(1);
        const durationInDays = 3;
        const nftId = 0
        const collectionAddress = mockCollectionDeployment.address

        await marketplaceWrapper.list(collectionAddress, nftId, price)
        const { offerId } = await marketplaceWrapper.makeOfferAndGetId(
            collectionAddress,
            nftId,
            price,
            durationInDays
        );

        await expect(
            marketplaceWrapper
            .withSignerIndex(2)
            .makeCounteroffer(
                collectionAddress,
                nftId,
                offerId,
                counterofferPrice,
                durationInDays
            )
        ).to.be.reverted
    })

});
