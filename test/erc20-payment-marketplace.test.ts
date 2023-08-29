import IERC20Artifact from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import { deployments, ethers, web3 } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { IERC20, IERC721, IErc20PaymentMarketplace } from "../typechain-types";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import MarketplaceWrapper from "../scripts/marketplace-wrapper";
import Erc20PaymentMarketplaceWrapper from "../scripts/erc20-payment-marketplace-wrapper";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";

describe("Testing Erc20PaymentMarketplace specific features", () => {
    let erc20: IERC20;
    let marketplaceAddress: Address;
    let erc721: IERC721;
    const erc20Decimals = 18;
    const nftId = 1;
    const price = ethers.utils.parseUnits("1", erc20Decimals);
    const offerPrice = ethers.utils.parseUnits("0.9", erc20Decimals);
    const offerId = 0;
    const _2percentPrice = price.div(50);
    const sellerIndex = 0;
    let seller: SignerWithAddress;
    const buyerIndex = 3;
    let buyer: SignerWithAddress;
    let someOtherAddress: Address;
    let marketplaceWrapper: MarketplaceWrapper;

    beforeEach(async () => {
        await deployments.fixture([
            "MockERC20",
            "Erc20PaymentMarketplace",
            "MockERC721Collection",
        ]);

        const deployment = await deployments.get("Erc20PaymentMarketplace");
        marketplaceAddress = deployment.address;

        erc20 = await ethers.getContract("MockERC20");
        erc721 = await ethers.getContract("MockERC721Collection");

        const signers = await ethers.getSigners();

        seller = signers[sellerIndex];

        buyer = signers[buyerIndex];

        const { someOtherAccount } = await ethers.getNamedSigners();
        someOtherAddress = someOtherAccount.address;

        marketplaceWrapper = new Erc20PaymentMarketplaceWrapper(
            marketplaceAddress,
            deployment.abi,
            erc20.address,
            IERC20Artifact.abi,
            web3.currentProvider as JsonRpcFetchFunc | ExternalProvider
        );
    });

    async function approveAndListBySeller() {
        await erc721.connect(seller).approve(marketplaceAddress, nftId);
        await marketplaceWrapper
            .withSigner(seller)
            .list(erc721.address, nftId, price);
    }

    async function approveAndMakeOffer() {
        await erc20.connect(buyer).approve(marketplaceAddress, offerPrice);
        const durationInDays = 3;
        await marketplaceWrapper
            .withSigner(buyer)
            .makeOffer(erc721.address, nftId, offerPrice, durationInDays);
    }

    describe("Buy function tests", () => {
        beforeEach(async () => {
            await approveAndListBySeller();
        });

        it("After the purchase the Marketplace's token balance should be equal to 2%NFTprice.", async () => {
            await marketplaceWrapper
                .withSigner(buyer)
                .buyAtPrice(erc721.address, nftId);

            const BY_1 = 1;
            expect(await erc20.balanceOf(marketplaceAddress)).to.be.closeTo(
                _2percentPrice,
                BY_1
            );
        });

        it("After the purchase the Seller's token balance should increase in NFTprice - 2%NFTprice.", async () => {
            const ERROR_MARGIN = 1;

            await expect(
                marketplaceWrapper
                    .withSigner(buyer)
                    .buyAtPrice(erc721.address, nftId)
            ).to.changeTokenBalance(
                erc20,
                seller.address,
                price.sub(_2percentPrice),
                ERROR_MARGIN
            );
        });

        it("If the buyer haven't enough money to purchase the NFT at its price, the transacton should revert.", async () => {
            await erc20
                .connect(buyer)
                .transfer(
                    someOtherAddress,
                    await erc20.balanceOf(buyer.address)
                );

            await expect(
                marketplaceWrapper
                    .withSigner(buyer)
                    .buyAtPrice(erc721.address, nftId)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("should revert if the contract hasn't sufficient allowance", async () => {
            await erc20.connect(buyer).approve(marketplaceAddress, 0);

            await expect(
                marketplaceWrapper.contract
                    .connect(buyer)
                    .buy(erc721.address, nftId)
            ).to.be.revertedWith("ERC20: insufficient allowance");
        });
    });

    describe("MakeOffer function tests", () => {
        const durationInDays = 3;

        beforeEach(async () => {
            await approveAndListBySeller();

            await erc20.connect(buyer).approve(marketplaceAddress, offerPrice);
        });

        it("Balance of Marketplace should increase in price offer.", async () => {
            await expect(
                marketplaceWrapper
                    .withSigner(buyer)
                    .makeOffer(
                        erc721.address,
                        nftId,
                        offerPrice,
                        durationInDays
                    )
            ).to.changeTokenBalance(erc20, marketplaceAddress, offerPrice);
        });

        it("The transaction should reverts if the price offer is less than minPriceOffer", async () => {
            const lessThanMinPriceOffer = ethers.utils.parseEther("0.1");
            await expect(
                marketplaceWrapper
                    .withSigner(buyer)
                    .makeOffer(
                        erc721.address,
                        nftId,
                        lessThanMinPriceOffer,
                        durationInDays
                    )
            ).to.be.revertedWith(
                "Marketplace: Price must be greater or equal than " +
                    "the minimum offer price for that NFT (call minPriceOffer())"
            );
        });
    });

    describe("Escrow functions's tests", () => {
        let owner: SignerWithAddress;

        beforeEach(async () => {
            await approveAndListBySeller();

            owner = await ethers.getNamedSigner("deployer");
        });

        it("The withdraw transaction should revert if the balance of Marketplace is greater than 0 and the fusyBenefitsAccumulated is 0.", async () => {
            await approveAndMakeOffer();

            const marketplaceBalance = await erc20.balanceOf(
                marketplaceAddress
            );
            expect(marketplaceBalance.gt(0)).to.be.true;

            const benefits =
                await marketplaceWrapper.call.fusyBenefitsAccumulated();
            expect(benefits.eq(0)).to.be.true;

            await expect(
                marketplaceWrapper.withSigner(owner).withdraw()
            ).to.be.revertedWith("Marketplace: Nothing to withdraw.");
        });

        it("After trade an NFT should be possible for the Marketplace's owner withdraw the fusyBenefitsAccumulated.", async () => {
            await approveAndBuy();

            const benefits =
                await marketplaceWrapper.call.fusyBenefitsAccumulated();

            expect(benefits).to.be.equal(
                await erc20.balanceOf(marketplaceAddress)
            );

            await expect(
                marketplaceWrapper.withSigner(owner).withdraw()
            ).to.changeTokenBalance(erc20, owner, benefits);
        });

        async function approveAndBuy() {
            await marketplaceWrapper
                .withSigner(buyer)
                .buyAtPrice(erc721.address, nftId);
        }
    });

    describe("TakeCounteroffer function tests", () => {
        const counterofferPrice = price.sub(1);
        const durationInDays = 3;

        beforeEach(async () => {
            await approveAndListBySeller();
            await approveAndMakeOffer();

            await marketplaceWrapper
                .withSigner(seller)
                .makeCounteroffer(
                    erc721.address,
                    nftId,
                    offerId,
                    counterofferPrice,
                    durationInDays
                );

            await erc20
                .connect(buyer)
                .approve(marketplaceAddress, counterofferPrice.sub(offerPrice));
        });

        it("should emit event CounterofferTaken", async () => {
            const counterofferId = 1;

            await expect(
                marketplaceWrapper.withSigner(buyer).takeCounterofferAtPrice(1)
            )
                .to.emit(marketplaceWrapper.contract, "CounterofferTaken")
                .withArgs(counterofferId, counterofferPrice, seller.address);
        });

        it("should transfer counteroffer price minus fee to seller", async () => {
            const fee = await marketplaceWrapper.call.getFusyonaFeeFor(
                counterofferPrice
            );

            await expect(
                marketplaceWrapper.withSigner(buyer).takeCounterofferAtPrice(1)
            ).to.changeTokenBalance(erc20, seller, counterofferPrice.sub(fee));
        });

        it("should only discount counterofferprice - offer price from buyer's balance", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);

            await expect(
                marketplaceWrapper.withSigner(buyer).takeCounterofferAtPrice(1)
            ).to.changeTokenBalance(erc20, buyer, `-${necessaryAmountToSend}`);
        });
    });

    describe("TakeOffer function tests", () => {
        beforeEach(async () => {
            await approveAndListBySeller();
            await approveAndMakeOffer();
        });

        it("should increase seller's balance by offer price - fees", async () => {
            const fees = offerPrice.div(50);
            const ERROR_MARGIN = 1;

            await expect(
                marketplaceWrapper
                    .withSigner(seller)
                    .takeOffer(erc721.address, nftId, offerId)
            ).to.changeTokenBalance(
                erc20,
                seller,
                offerPrice.sub(fees),
                ERROR_MARGIN
            );
        });

        it("should decrease marketplace balance by offer price - fees", async () => {
            const fees = offerPrice.div(50);
            const ERROR_MARGIN = 1;

            await expect(
                marketplaceWrapper
                    .withSigner(seller)
                    .takeOffer(erc721.address, nftId, offerId)
            ).to.changeTokenBalance(
                erc20,
                marketplaceAddress,
                `-${offerPrice.sub(fees)}`,
                ERROR_MARGIN
            );
        });
    });

    describe("CancelOffer function's tests", () => {
        beforeEach(async () => {
            await approveAndListBySeller();
            await approveAndMakeOffer();
        });

        it("When an offer is cancelled, the money that collateralize it, it's go out from the Marketplace Contract.", async () => {
            await expect(
                marketplaceWrapper
                    .withSigner(buyer)
                    .cancelOffer(erc721.address, nftId, offerId)
            )
                .to.changeTokenBalance(
                    erc20,
                    marketplaceAddress,
                    `-${offerPrice}`
                )
                .to.changeTokenBalance(erc20, buyer.address, offerPrice);
        });
    });
});
