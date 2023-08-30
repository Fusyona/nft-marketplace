import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    FusyERC721CollectionWithRoyaltySupport,
    Marketplace,
    MsgValuePaymentMarketplace,
    Erc20PaymentMarketplace,
    IERC20,
} from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";

describe("Royalty support tests", () => {
    const ERROR_MARGIN = 1;
    let creator: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let msgValueMarketplace: MsgValuePaymentMarketplace;
    let erc20Marketplace: Erc20PaymentMarketplace;
    let collectionContractWithERC2981: FusyERC721CollectionWithRoyaltySupport;
    let payToken: IERC20;

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
            "MockERC20",
            "Erc20PaymentMarketplace",
        ]);

        collectionContractWithERC2981 = await ethers.getContract(
            "FusyERC721CollectionWithRoyaltySupport"
        );
        msgValueMarketplace = await ethers.getContract(
            "MsgValuePaymentMarketplace"
        );
        payToken = await ethers.getContract("MockERC20");
        erc20Marketplace = await ethers.getContract("Erc20PaymentMarketplace");
    });

    describe("MsgValuePaymentMarketplace", () => {
        beforeEach(async () => {
            await collectionContractWithERC2981.connect(seller).createNFT();
            await collectionContractWithERC2981
                .connect(seller)
                .approve(msgValueMarketplace.address, nftId);

            await msgValueMarketplace
                .connect(seller)
                .list(collectionContractWithERC2981.address, nftId, nftPrice);
        });

        async function expectToChangeEtherBalance(
            trxPromise: (
                marketplace: Marketplace
            ) => Promise<ContractTransaction>,
            target: Address,
            balanceChange: number | BigNumber,
            errorMargin: number | BigNumber
        ) {
            const balanceBefore = await ethers.provider.getBalance(target);
            await trxPromise(msgValueMarketplace);
            const balanceAfter = await ethers.provider.getBalance(target);

            expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
                balanceChange,
                errorMargin
            );
        }

        describe("buy()", () => {
            const royalty = nftPrice.div(10);

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
                    msgValueMarketplace
                        .connect(buyer)
                        .buy(collectionContractWithERC2981.address, nftId, {
                            value: nftPrice,
                        })
                )
                    .to.emit(msgValueMarketplace, "RoyaltyPayment")
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
                await makeOffer();
                await makeCounteroffer();
            });

            async function makeOffer() {
                const DURATION_IN_DAYS = 3;
                await msgValueMarketplace
                    .connect(buyer)
                    .makeOffer(
                        collectionContractWithERC2981.address,
                        nftId,
                        DURATION_IN_DAYS,
                        {
                            value: offerPrice,
                        }
                    );
            }

            async function makeCounteroffer() {
                const OFFER_ID = 0;
                const DURATION_IN_DAYS = 3;
                await msgValueMarketplace
                    .connect(seller)
                    .makeCounteroffer(
                        collectionContractWithERC2981.address,
                        nftId,
                        OFFER_ID,
                        counterofferPrice,
                        DURATION_IN_DAYS
                    );
            }

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
                    msgValueMarketplace
                        .connect(buyer)
                        .takeCounteroffer(COUNTER_OFFER_ID, {
                            value: counterofferPrice,
                        })
                )
                    .to.emit(msgValueMarketplace, "RoyaltyPayment")
                    .withArgs(
                        collectionContractWithERC2981.address,
                        nftId,
                        creator.address,
                        royalty
                    );
            });
        });
    });

    describe("Erc20PaymentMarketplace", () => {
        beforeEach(async () => {
            await mintNft();
            await approveNftSpending();
            await listNft();
        });

        async function mintNft() {
            await collectionContractWithERC2981.connect(seller).createNFT();
        }

        async function approveNftSpending() {
            await collectionContractWithERC2981
                .connect(seller)
                .approve(erc20Marketplace.address, nftId);
        }

        async function listNft() {
            await erc20Marketplace
                .connect(seller)
                .list(collectionContractWithERC2981.address, nftId, nftPrice);
        }

        describe("buy()", () => {
            const royalty = nftPrice.div(10);

            beforeEach(async () => {
                await payToken
                    .connect(buyer)
                    .approve(erc20Marketplace.address, nftPrice);
            });

            it("should discount royalty from the seller", async () => {
                const fee = nftPrice.div(50);

                await expect(
                    erc20Marketplace
                        .connect(buyer)
                        .buy(collectionContractWithERC2981.address, nftId)
                ).to.changeTokenBalance(
                    payToken,
                    seller.address,
                    nftPrice.sub(royalty).sub(fee),
                    ERROR_MARGIN
                );
            });

            it("should send royalty to the creator", async () => {
                await expect(
                    erc20Marketplace
                        .connect(buyer)
                        .buy(collectionContractWithERC2981.address, nftId)
                ).to.changeTokenBalance(
                    payToken,
                    creator.address,
                    royalty,
                    ERROR_MARGIN
                );
            });

            it("should emit RoyaltyPayment event", async () => {
                await expect(
                    erc20Marketplace
                        .connect(buyer)
                        .buy(collectionContractWithERC2981.address, nftId)
                )
                    .to.emit(erc20Marketplace, "RoyaltyPayment")
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
                await payToken
                    .connect(buyer)
                    .approve(erc20Marketplace.address, counterofferPrice);

                await makeOffer();
                await makeCounteroffer();
            });

            async function makeOffer() {
                const DURATION_IN_DAYS = 3;
                await erc20Marketplace
                    .connect(buyer)
                    .makeOffer(
                        collectionContractWithERC2981.address,
                        nftId,
                        offerPrice,
                        DURATION_IN_DAYS
                    );
            }

            async function makeCounteroffer() {
                const OFFER_ID = 0;
                const DURATION_IN_DAYS = 3;
                await erc20Marketplace
                    .connect(seller)
                    .makeCounteroffer(
                        collectionContractWithERC2981.address,
                        nftId,
                        OFFER_ID,
                        counterofferPrice,
                        DURATION_IN_DAYS
                    );
            }

            it("should discount royalty from the seller", async () => {
                const fee = counterofferPrice.div(50);

                await expect(
                    erc20Marketplace
                        .connect(buyer)
                        .takeCounteroffer(COUNTER_OFFER_ID)
                ).to.changeTokenBalance(
                    payToken,
                    seller.address,
                    counterofferPrice.sub(royalty).sub(fee),
                    ERROR_MARGIN
                );
            });

            it("should send royalty to the creator", async () => {
                await expect(
                    erc20Marketplace
                        .connect(buyer)
                        .takeCounteroffer(COUNTER_OFFER_ID)
                ).to.changeTokenBalance(
                    payToken,
                    creator.address,
                    royalty,
                    ERROR_MARGIN
                );
            });

            it("should emit RoyaltyPayment event", async () => {
                await expect(
                    erc20Marketplace
                        .connect(buyer)
                        .takeCounteroffer(COUNTER_OFFER_ID)
                )
                    .to.emit(erc20Marketplace, "RoyaltyPayment")
                    .withArgs(
                        collectionContractWithERC2981.address,
                        nftId,
                        creator.address,
                        royalty
                    );
            });
        });
    });
});
