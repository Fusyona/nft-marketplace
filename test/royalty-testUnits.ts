import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    FusyERC721CollectionWithRoyaltySupport,
    Marketplace,
    IERC721,
    MsgValuePaymentMarketplace,
} from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";

describe("Royalty support tests", () => {
    const ERROR_MARGIN = 1;
    let creator: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let marketplace: MsgValuePaymentMarketplace;
    let collectionContractWithoutERC2981: IERC721;
    let collectionContractWithERC2981: FusyERC721CollectionWithRoyaltySupport;

    let nftId = 1;
    const nftPrice = ethers.utils.parseEther("10");

    before(async () => {
        const signers = await ethers.getNamedSigners();
        creator = signers.creator;
        seller = signers.seller;
        buyer = signers.buyer;
    });

    beforeEach(async () => {
        await deployments.fixture([
            "MockERC721Collection",
            "FusyERC721CollectionWithRoyaltySupport",
            "MsgValuePaymentMarketplace",
        ]);

        collectionContractWithoutERC2981 = await ethers.getContract(
            "MockERC721Collection"
        );
        collectionContractWithERC2981 = await ethers.getContract(
            "FusyERC721CollectionWithRoyaltySupport"
        );
        marketplace = await ethers.getContract("MsgValuePaymentMarketplace");
    });

    async function expectToChangeEtherBalance(
        trxPromise: (marketplace: Marketplace) => Promise<ContractTransaction>,
        target: Address,
        balanceChange: number | BigNumber,
        errorMargin: number | BigNumber
    ) {
        const balanceBefore = await ethers.provider.getBalance(target);
        await trxPromise(marketplace);
        const balanceAfter = await ethers.provider.getBalance(target);

        expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
            balanceChange,
            errorMargin
        );
    }

    async function createAndApproveNFT(
        collection: IERC721 | FusyERC721CollectionWithRoyaltySupport
    ) {
        if (isFusyERC721CollectionWithRoyaltySupport(collection)) {
            await collection.connect(seller).createNFT();
        }

        await collection.connect(seller).approve(marketplace.address, nftId);
    }

    function isFusyERC721CollectionWithRoyaltySupport(
        collection: IERC721 | FusyERC721CollectionWithRoyaltySupport
    ): collection is FusyERC721CollectionWithRoyaltySupport {
        return collection.address === collectionContractWithERC2981.address;
    }

    async function listNft(
        collection: IERC721 | FusyERC721CollectionWithRoyaltySupport
    ) {
        return await marketplace
            .connect(seller)
            .list(collection.address, nftId, nftPrice);
    }

    describe("buy()", () => {
        const royalty = nftPrice.div(10);

        beforeEach(async () => {
            await createAndApproveNFT(collectionContractWithERC2981);
            await listNft(collectionContractWithERC2981);
        });

        it("should discount royalty from the seller", async () => {
            const fee = nftPrice.div(50);

            await expectToChangeEtherBalance(
                (m) =>
                    m
                        .connect(buyer)
                        .buy(collectionContractWithERC2981.address, nftId, {
                            value: nftPrice,
                        }),
                seller.address,
                nftPrice.sub(royalty).sub(fee),
                ERROR_MARGIN
            );
        });

        it("should send royalty to the creator", async () => {
            await expectToChangeEtherBalance(
                (m) =>
                    m
                        .connect(buyer)
                        .buy(collectionContractWithERC2981.address, nftId, {
                            value: nftPrice,
                        }),
                creator.address,
                royalty,
                ERROR_MARGIN
            );
        });

        it("should emit RoyaltyPayment event", async () => {
            await expect(
                marketplace
                    .connect(buyer)
                    .buy(collectionContractWithERC2981.address, nftId, {
                        value: nftPrice,
                    })
            )
                .to.emit(marketplace, "RoyaltyPayment")
                .withArgs(
                    collectionContractWithERC2981.address,
                    nftId,
                    creator.address,
                    royalty
                );
        });
    });

    describe("takeCounteroffer()", async () => {
        const offerPrice = nftPrice.sub(2);
        const counterofferPrice = offerPrice.add(1);
        const COUNTER_OFFER_ID = 1;
        const royalty = counterofferPrice.div(10);

        beforeEach(async () => {
            await createAndApproveNFT(collectionContractWithERC2981);
            await listNft(collectionContractWithERC2981);

            await marketplace
                .connect(buyer)
                .makeOffer(collectionContractWithERC2981.address, nftId, 3, {
                    value: offerPrice,
                });

            await marketplace
                .connect(seller)
                .makeCounteroffer(
                    collectionContractWithERC2981.address,
                    nftId,
                    0,
                    counterofferPrice,
                    3
                );
        });

        it("should discount royalty from the seller", async () => {
            const fee = counterofferPrice.div(50);

            await expectToChangeEtherBalance(
                (m) =>
                    m.connect(buyer).takeCounteroffer(COUNTER_OFFER_ID, {
                        value: counterofferPrice,
                    }),
                seller.address,
                counterofferPrice.sub(royalty).sub(fee),
                ERROR_MARGIN
            );
        });

        it("should send royalty to the creator", async () => {
            await expectToChangeEtherBalance(
                (m) =>
                    m.connect(buyer).takeCounteroffer(COUNTER_OFFER_ID, {
                        value: counterofferPrice,
                    }),
                creator.address,
                royalty,
                ERROR_MARGIN
            );
        });

        it("should emit RoyaltyPayment event", async () => {
            await expect(
                marketplace.connect(buyer).takeCounteroffer(COUNTER_OFFER_ID, {
                    value: counterofferPrice,
                })
            )
                .to.emit(marketplace, "RoyaltyPayment")
                .withArgs(
                    collectionContractWithERC2981.address,
                    nftId,
                    creator.address,
                    royalty
                );
        });
    });
});
