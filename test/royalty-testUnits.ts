import { expect } from "chai";
import { deployments, ethers, web3 } from "hardhat";
import {
    FusyERC721CollectionWithRoyaltySupport,
    IERC20,
} from "../typechain-types";
import IErc20Artifact from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import MarketplaceWrapper from "../scripts/marketplace-wrapper";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";
import MsgValuePaymentMarketplaceWrapper from "../scripts/msg-value-payment-marketplace-wrapper";
import Erc20PaymentMarketplaceWrapper from "../scripts/erc20-payment-marketplace-wrapper";
import { contractNames } from "../utils/constants";

describe("Royalty support tests", () => {
    const ERROR_MARGIN = 1;
    let creator: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

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
            contractNames.MockERC721Collection,
            contractNames.FusyERC721CollectionWithRoyaltySupport,
            contractNames.MsgValuePaymentMarketplace,
            contractNames.MockERC20,
            contractNames.Erc20PaymentMarketplace,
        ]);

        collectionContractWithERC2981 = await ethers.getContract(
            contractNames.FusyERC721CollectionWithRoyaltySupport
        );
    });

    describe(contractNames.MsgValuePaymentMarketplace, () => {
        let msgValueMarketplaceWrapper: MsgValuePaymentMarketplaceWrapper;

        beforeEach(async () => {
            msgValueMarketplaceWrapper = await getMsgValueMarketplaceWrapper();

            await collectionContractWithERC2981.connect(seller).createNFT();
            await collectionContractWithERC2981
                .connect(seller)
                .approve(msgValueMarketplaceWrapper.contract.address, nftId);

            await msgValueMarketplaceWrapper
                .withSigner(seller)
                .list(collectionContractWithERC2981.address, nftId, nftPrice);
        });

        async function getMsgValueMarketplaceWrapper() {
            const { address, abi } = await deployments.get(
                contractNames.MsgValuePaymentMarketplace
            );
            return new MsgValuePaymentMarketplaceWrapper(
                address,
                abi,
                web3.currentProvider as ExternalProvider | JsonRpcFetchFunc
            );
        }

        async function expectToChangeEtherBalance(
            trxPromise: (
                wrapper: MarketplaceWrapper
            ) => Promise<ContractTransaction>,
            target: Address,
            balanceChange: number | BigNumber,
            errorMargin: number | BigNumber
        ) {
            const balanceBefore = await ethers.provider.getBalance(target);
            await trxPromise(msgValueMarketplaceWrapper);
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
                            .withSigner(buyer)
                            .buyAtPrice(
                                collectionContractWithERC2981.address,
                                nftId
                            ),
                    seller.address,
                    nftPrice.sub(royalty).sub(fee),
                    ERROR_MARGIN
                );
            });

            it("should send royalty to the creator", async () => {
                await expectToChangeEtherBalance(
                    (m) =>
                        m
                            .withSigner(buyer)
                            .buyAtPrice(
                                collectionContractWithERC2981.address,
                                nftId
                            ),
                    creator.address,
                    royalty,
                    ERROR_MARGIN
                );
            });

            it("should emit RoyaltyPayment event", async () => {
                await expect(
                    msgValueMarketplaceWrapper
                        .withSigner(buyer)
                        .buyAtPrice(
                            collectionContractWithERC2981.address,
                            nftId
                        )
                )
                    .to.emit(
                        msgValueMarketplaceWrapper.contract,
                        "RoyaltyPayment"
                    )
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
                await msgValueMarketplaceWrapper
                    .withSigner(buyer)
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
                await msgValueMarketplaceWrapper
                    .withSigner(seller)
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
                        m
                            .withSigner(buyer)
                            .takeCounterofferAtPrice(COUNTER_OFFER_ID),
                    seller.address,
                    counterofferPrice.sub(royalty).sub(fee),
                    ERROR_MARGIN
                );
            });

            it("should send royalty to the creator", async () => {
                await expectToChangeEtherBalance(
                    (m) =>
                        m
                            .withSigner(buyer)
                            .takeCounterofferAtPrice(COUNTER_OFFER_ID),
                    creator.address,
                    royalty,
                    ERROR_MARGIN
                );
            });

            it("should emit RoyaltyPayment event", async () => {
                await expect(
                    msgValueMarketplaceWrapper
                        .withSigner(buyer)
                        .takeCounterofferAtPrice(COUNTER_OFFER_ID)
                )
                    .to.emit(
                        msgValueMarketplaceWrapper.contract,
                        "RoyaltyPayment"
                    )
                    .withArgs(
                        collectionContractWithERC2981.address,
                        nftId,
                        creator.address,
                        royalty
                    );
            });
        });
    });

    describe(contractNames.Erc20PaymentMarketplace, () => {
        let erc20MarketplaceWrapper: Erc20PaymentMarketplaceWrapper;
        let payToken: IERC20;

        beforeEach(async () => {
            payToken = await ethers.getContract(contractNames.MockERC20);
            erc20MarketplaceWrapper = await getErc20MarketplaceWrapper();

            await mintNft();
            await approveNftSpending();
            await listNft();
        });

        async function getErc20MarketplaceWrapper() {
            const { address, abi } = await deployments.get(
                contractNames.Erc20PaymentMarketplace
            );
            return new Erc20PaymentMarketplaceWrapper(
                address,
                abi,
                payToken.address,
                IErc20Artifact.abi,
                web3.currentProvider as ExternalProvider | JsonRpcFetchFunc
            );
        }

        async function mintNft() {
            await collectionContractWithERC2981.connect(seller).createNFT();
        }

        async function approveNftSpending() {
            await collectionContractWithERC2981
                .connect(seller)
                .approve(erc20MarketplaceWrapper.contract.address, nftId);
        }

        async function listNft() {
            await erc20MarketplaceWrapper
                .withSigner(seller)
                .list(collectionContractWithERC2981.address, nftId, nftPrice);
        }

        describe("buy()", () => {
            const royalty = nftPrice.div(10);

            it("should discount royalty from the seller", async () => {
                const fee = nftPrice.div(50);

                await expect(
                    erc20MarketplaceWrapper
                        .withSigner(buyer)
                        .buyAtPrice(
                            collectionContractWithERC2981.address,
                            nftId
                        )
                ).to.changeTokenBalance(
                    payToken,
                    seller.address,
                    nftPrice.sub(royalty).sub(fee),
                    ERROR_MARGIN
                );
            });

            it("should send royalty to the creator", async () => {
                await expect(
                    erc20MarketplaceWrapper
                        .withSigner(buyer)
                        .buyAtPrice(
                            collectionContractWithERC2981.address,
                            nftId
                        )
                ).to.changeTokenBalance(
                    payToken,
                    creator.address,
                    royalty,
                    ERROR_MARGIN
                );
            });

            it("should emit RoyaltyPayment event", async () => {
                await expect(
                    erc20MarketplaceWrapper
                        .withSigner(buyer)
                        .buyAtPrice(
                            collectionContractWithERC2981.address,
                            nftId
                        )
                )
                    .to.emit(erc20MarketplaceWrapper.contract, "RoyaltyPayment")
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
                await erc20MarketplaceWrapper
                    .withSigner(buyer)
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
                await erc20MarketplaceWrapper
                    .withSigner(seller)
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
                    erc20MarketplaceWrapper
                        .withSigner(buyer)
                        .takeCounterofferAtPrice(COUNTER_OFFER_ID)
                ).to.changeTokenBalance(
                    payToken,
                    seller.address,
                    counterofferPrice.sub(royalty).sub(fee),
                    ERROR_MARGIN
                );
            });

            it("should send royalty to the creator", async () => {
                await expect(
                    erc20MarketplaceWrapper
                        .withSigner(buyer)
                        .takeCounterofferAtPrice(COUNTER_OFFER_ID)
                ).to.changeTokenBalance(
                    payToken,
                    creator.address,
                    royalty,
                    ERROR_MARGIN
                );
            });

            it("should emit RoyaltyPayment event", async () => {
                await expect(
                    erc20MarketplaceWrapper
                        .withSigner(buyer)
                        .takeCounterofferAtPrice(COUNTER_OFFER_ID)
                )
                    .to.emit(erc20MarketplaceWrapper.contract, "RoyaltyPayment")
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
