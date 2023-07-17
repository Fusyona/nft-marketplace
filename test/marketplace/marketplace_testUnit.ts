import { time } from "@nomicfoundation/hardhat-network-helpers";
import { assert, expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { deployments, ethers } from "hardhat";
import { Address, Deployment } from "hardhat-deploy/types";
import MarketplaceWrapperForOneSigner from "../../scripts/marketplace-wrapper-for-one-signer";
import MarketplaceWrapperForOneSigner_Builder from "../../scripts/marketplace-wrapper-for-one-signer.builder";
import MarketplaceWrapperForOneSigner_Director from "../../scripts/marketplace-wrapper-for-one-signer.director";
import { ERC1155, MockERC1155Collection } from "../../typechain-types";
import { toABDKMath64x64 } from "../utils";

type SignerWithAddress = Signer & { address: Address };

describe("Testing Marketplace Smart Contract", () => {
    let signer: SignerWithAddress;
    const OWNER_SIGNER_INDEX = 0;
    let marketplaceDeployment: Deployment;
    let mockERC1155CollectionDeployment: Deployment;
    const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
    let BN = BigNumber;
    const twoUp64 = BN.from(2).pow(64);
    const _2percent = BN.from(2).mul(twoUp64).div(BN.from(100));

    beforeEach(async () => {
        await deployments.fixture(["Marketplace", "MockERC1155Collection"]);
        await setInstances();
        await defaultSigner();
    });

    async function defaultSigner() {
        const signers = await ethers.getSigners();
        signer = signers[OWNER_SIGNER_INDEX] as unknown as SignerWithAddress;
    }

    async function getAnotherSigner(x: number) {
        if (x === 0) {
            throw new Error("O is the defaultSigner's index.");
        }
        const signers = await ethers.getSigners();
        return signers[x] as unknown as SignerWithAddress;
    }

    async function setInstances() {
        marketplaceDeployment = await deployments.get("Marketplace");
        mockERC1155CollectionDeployment = await deployments.get(
            "MockERC1155Collection"
        );
    }

    async function tMakeOffer(
        marketplace: MarketplaceWrapperForOneSigner,
        collectionAddress: Address,
        nftId: number | BigNumber,
        priceOffer: BigNumber,
        durationInDays: number
    ) {
        await marketplace.makeOffer(
            collectionAddress,
            nftId,
            priceOffer,
            durationInDays
        );
    }

    async function tApprove(
        marketplace: MarketplaceWrapperForOneSigner,
        signer?: Signer
    ) {
        try {
            await (
                await mockCollection(signer)
            ).setApprovalForAll(marketplace.contract.address, true);
        } catch (error) {
            throw error;
        }
    }

    class NftSaleHelper {
        constructor(
            private sellerSignerIndex: number,
            private nftPrice: BigNumber,
            private buyerMarketplace: MarketplaceWrapperForOneSigner
        ) {}

        async setupAndMakeOffer(
            collectionAddress: string,
            nftId: BigNumber | number,
            offerPrice: BigNumber | number = 90,
            durationInDays = 3
        ) {
            const seller = (await ethers.getSigners())[this.sellerSignerIndex];
            await tSafeTransferFrom(signer, seller.address, nftId);
            await approveAndListingByASeller(
                collectionAddress,
                nftId,
                this.nftPrice,
                this.sellerSignerIndex
            );
            await this.buyerMarketplace.makeOffer(
                collectionAddress,
                nftId,
                offerPrice,
                durationInDays
            );
            const offerId = 0;
            return offerId;
        }
    }

    async function tSafeTransferFrom(
        signer: SignerWithAddress,
        to: string,
        nftid: number | BigNumber
    ) {
        try {
            await (
                await mockCollection(signer)
            ).safeTransferFrom(signer.address, to, nftid, "1", []);
        } catch (error) {
            throw error;
        }
    }

    async function mockCollection(signer?: Signer): Promise<ERC1155> {
        try {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const mockCollection = await ethers.getContractAt(
                "ERC1155",
                collectionAddress,
                signer
            );
            return mockCollection as ERC1155;
        } catch (error) {
            throw error;
        }
    }

    async function tList(
        marketplace: MarketplaceWrapperForOneSigner,
        collectionAddress: Address,
        nftId: number | BigNumber,
        price: BigNumber
    ) {
        await marketplace.list(collectionAddress, nftId, price);
    }

    async function tBalanceOf(account: Address, nftId: number | BigNumber) {
        try {
            return await (await mockCollection()).balanceOf(account, nftId);
        } catch (error) {
            console.error(error);
        }
    }

    async function approveAndListingByASeller(
        collectionAddress: Address,
        nftId: number | BigNumber,
        price: BigNumber,
        sellerSignerIndex = 0
    ) {
        try {
            let marketplace = getMarketplaceFromSignerIndex(sellerSignerIndex);

            const seller = (await ethers.getSigners())[
                sellerSignerIndex
            ] as unknown as Signer;
            await tApprove(marketplace, seller);
            await tList(marketplace, collectionAddress, nftId, price);
        } catch (error) {
            throw error;
        }
    }

    function getMarketplaceFromSignerIndex(signerIndex: number) {
        const builder = new MarketplaceWrapperForOneSigner_Builder();
        MarketplaceWrapperForOneSigner_Director.hardhatConfig(builder);
        return builder
            .withContractAddress(marketplaceDeployment.address)
            .withSignerIndex(signerIndex)
            .build();
    }

    function getMarketplaceForOwner() {
        return getMarketplaceFromSignerIndex(0);
    }

    it("Marketplace should be deployed, therefore, it has linked an address", async () => {
        const zeroAddress = ethers.constants.AddressZero;
        const marketplaceAddress = marketplaceDeployment.address;
        assert.notEqual(
            marketplaceAddress,
            zeroAddress,
            "Wrong Marketplace address deployed"
        );
    });

    describe("List functions's tests.", () => {
        let marketplace: MarketplaceWrapperForOneSigner;
        let collectionAddress: Address;
        const nftId1 = 1;
        const price = ethers.utils.parseEther("1");

        beforeEach(async () => {
            marketplace = getMarketplaceForOwner();
            collectionAddress = mockERC1155CollectionDeployment.address;
        });

        it("A NFT should be listed using list function.", async () => {
            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();

            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId, price);
            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();
            assert.equal(
                _tvlAfterList,
                _tvlBeforeList + 1,
                "_tvlAfterList should be increased plus one"
            );
        });

        it("If there are more than two NFT in the marketplace the function totalOfNFTListed should returns 2", async () => {
            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();

            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = 1;
            const nftId2 = 2;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId1, price);
            await tList(marketplace, collectionAddress, nftId2, price);

            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();

            assert.equal(
                _tvlAfterList,
                _tvlBeforeList + 2,
                "_tvlAfterList should be increased plus two"
            );
        });

        it("An exception should revert if an user try to list twice the same NFT.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = 1;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId1, price);
            await expect(
                tList(marketplace, collectionAddress, nftId1, price)
            ).to.be.revertedWith("Marketplace: NFT already listed");
        });

        it("If an user owner of a NFT try to list that nft before it grants to Marketplace rigths over its token, then an exception should be thrown.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = 1;
            const price = ethers.utils.parseEther("1");

            await expect(
                tList(marketplace, collectionAddress, nftId1, price)
            ).to.be.revertedWith(
                "ERC1155: caller is not token owner or approved"
            );
        });

        it("should revert if sender doesn't own the NFT", async () => {
            const NOT_THE_OWNER_INDEX = 3;
            const notTheOwnerApi =
                getMarketplaceFromSignerIndex(NOT_THE_OWNER_INDEX);

            await expect(
                tList(notTheOwnerApi, collectionAddress, nftId1, price)
            ).to.be.revertedWith("Marketplace: You don't own the NFT");
        });

        it("should revert if price is 0", async () => {
            const price = BN.from(0);
            await expect(
                tList(marketplace, collectionAddress, nftId1, price)
            ).to.be.revertedWith("Marketplace: Price must be greater than 0");
        });
    });

    describe("Buy function's tests", () => {
        const BUYER_SIGNER_INDEX = 1;
        let buyer: SignerWithAddress;
        let marketplace: MarketplaceWrapperForOneSigner;

        beforeEach(async () => {
            marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            buyer = await getAnotherSigner(BUYER_SIGNER_INDEX);
        });

        it("If one NFT is bought then the totalOfNFT listed should decrease in less one.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const _tvlBeforeBuy = BN.from(
                await marketplace.totalOfNFTListed()
            ).toNumber();
            await marketplace.buy(collectionAddress, nftId);
            const _tvlAfterBuy = BN.from(
                await marketplace.totalOfNFTListed()
            ).toNumber();
            assert.equal(
                _tvlAfterBuy,
                _tvlBeforeBuy - 1,
                "The totalOfNFTListed should decreased in less one."
            );
        });

        it("After the purchase the Marketplace's ether balance should be equal to 2%NFTprice.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const actualBalanceOfMarketplaceBeforeBuy = BigNumber.from(
                await ethers.provider.getBalance(marketplace.contract.address)
            );
            const _2percentPrice = _2percent.mul(price).div(twoUp64);
            const expectedBalanceOfMarketplace =
                actualBalanceOfMarketplaceBeforeBuy.add(_2percentPrice);

            await marketplace.buy(collectionAddress, nftId);

            const actualBalanceOfMarketplace = await ethers.provider.getBalance(
                marketplace.contract.address
            );
            assert.equal(
                actualBalanceOfMarketplace.toString(),
                expectedBalanceOfMarketplace.toString(),
                "The balance of Marketplace is not equal to 2%NFTprice."
            );
        });

        it("After the purchase the Seller's ether balance should increase in NFTprice - 2%NFTprice.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const _2percentPrice = _2percent.mul(price).div(twoUp64);

            await approveAndListingByASeller(collectionAddress, nftId, price);
            const balanceOfSellerAfterList = BigNumber.from(
                await ethers.provider.getBalance(signer.address)
            );
            const expectedBalanceOfSeller = balanceOfSellerAfterList.add(
                price.sub(_2percentPrice)
            );

            await marketplace.buy(collectionAddress, nftId);

            const actualBalanceOfSeller = await ethers.provider.getBalance(
                signer.address
            );

            assert.equal(
                actualBalanceOfSeller.toString(),
                expectedBalanceOfSeller.toString(),
                "The balance of Seller is not equal to NFTprice - 2%NFTprice."
            );
        });

        it("Buyer's NFT balance previously to the purchase should be equal to 0.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);
            const buyer = await getAnotherSigner(BUYER_SIGNER_INDEX);

            const balanceOfBuyerInNFT = (
                await tBalanceOf(buyer.address, nftId)
            )?.toString();

            assert.equal(
                balanceOfBuyerInNFT,
                "0",
                "Buyer's NFT balance previusly to the purchase should be equal to 0."
            );
        });

        it("Buyer's NFT balance after the purchase should increase in one.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);

            await marketplace.buy(collectionAddress, nftId);

            const balanceOfBuyerInNFT = (
                await tBalanceOf(buyer.address, nftId)
            )?.toString();
            assert.equal(
                balanceOfBuyerInNFT,
                "1",
                "Buyer's NFT balance after the purchase should increase in 1."
            );
        });

        it("If the buyer haven't enough money to purchase the NFT at its price, the transacton should revert.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("10000.1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const wrappedFunction = async () => {
                await marketplace.buy(collectionAddress, nftId);
            };
            expect(wrappedFunction).to.throw;
        });

        it("If a buyer try to buy an unlisted token, the transaction should revert.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;

            await expect(
                marketplace.buy(collectionAddress, nftId)
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });

        it("After unlisted a NFT it's not possible make the same purchase, avoiding double spent.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);
            const SCAMMER_SIGNER_INDEX = 2;

            await marketplace.buy(collectionAddress, nftId);

            marketplace = getMarketplaceFromSignerIndex(SCAMMER_SIGNER_INDEX);

            await expect(
                marketplace.buy(collectionAddress, nftId)
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });

        it("should revert if the sent amount is not enough", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const contract = marketplace.contract;
            const notEnoughAmount = price.sub(1);
            await expect(
                contract.buy(collectionAddress, nftId, {
                    value: notEnoughAmount,
                })
            ).to.be.revertedWith("Marketplace: Sent amount not enough");
        });
    });

    describe("MakeOffer function's tests. ", () => {
        const BUYER_SIGNER_INDEX = 1;
        let buyer: Signer;
        let marketplace: MarketplaceWrapperForOneSigner;

        beforeEach(async () => {
            marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            buyer = await getAnotherSigner(BUYER_SIGNER_INDEX);
        });

        it("A user can make an offer over a NFT that it already was listed.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                priceOffer,
                durationInDays
            );
            const actualMaxOffersOfThisNFT = (
                await marketplace.offersOf(collectionAddress, nftId)
            ).toString();
            const expectedMaxOffersOfThisNFT = "1";
            assert.equal(
                actualMaxOffersOfThisNFT,
                expectedMaxOffersOfThisNFT,
                "After a NFT is listed, when it receives an offer, the NFT's max number of offers should increase in 1."
            );
        });

        it("Balance of Marketplace should increase in price offer.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;
            const expectedBalanceOfMarketplace = BigNumber.from(
                await ethers.provider.getBalance(marketplace.contract.address)
            ).add(priceOffer);
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                priceOffer,
                durationInDays
            );
            const actualBalanceOfMarketplace = await ethers.provider.getBalance(
                marketplace.contract.address
            );
            expect(
                actualBalanceOfMarketplace.toString(),
                "Balance of Marketplace should increase in price offer."
            ).to.be.eq(expectedBalanceOfMarketplace.toString());
        });

        it("After a buyer make an offer, he hasn't the NFT's ownership yet.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                priceOffer,
                durationInDays
            );
            const balanceOfBuyerAfterMakeOffer = await tBalanceOf(
                await buyer.getAddress(),
                nftId
            );
            const balanceOfMarketplaceAfterMakeOffer = await tBalanceOf(
                marketplace.contract.address,
                nftId
            );
            const actualDifference = balanceOfMarketplaceAfterMakeOffer?.sub(
                BN.from(balanceOfBuyerAfterMakeOffer)
            );
            const expectedDifference = "1";
            expect(
                actualDifference,
                "Marketplace should keep the NFT property."
            ).to.be.eq(expectedDifference);
        });

        it("The transaction should reverts if the price offer is less than minPriceOffer", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const priceOffer = ethers.utils.parseEther("0.1");
            const durationInDays = 3;

            await expect(
                tMakeOffer(
                    marketplace,
                    collectionAddress,
                    nftId,
                    priceOffer,
                    durationInDays
                )
            ).to.be.revertedWith(
                "Marketplace: Price must be greater or equal than " +
                    "the minimum offer price for that NFT (call minPriceOffer())"
            );
        });

        it("The transaction should reverts if a buyer try to make an offer over an unlisted NFT.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;

            await expect(
                tMakeOffer(
                    marketplace,
                    collectionAddress,
                    nftId,
                    priceOffer,
                    durationInDays
                )
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });
    });

    describe("Escrow functions's tests", () => {
        let marketplace: MarketplaceWrapperForOneSigner;
        beforeEach(async () => {
            marketplace = getMarketplaceForOwner();
        });

        it("Whether there's not sales, the fusyBenefitsAccumulated should be equal to 0.", async () => {
            await presetRequirements();
            const expectedFusyBenefitsAcc = "0";
            const actualFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();
            expect(actualFusyBenefitsAcc.toString()).to.be.eq(
                expectedFusyBenefitsAcc
            );
        });

        it("The withdraw transaction should revert if the balance of Marketplace is greater than 0 and the fusyBenefitsAccumulated is 0.", async () => {
            await presetRequirements();

            const balanceOfMarketPlace = BigNumber.from(
                await ethers.provider.getBalance(marketplaceDeployment.address)
            );
            const fusyBenefitsAccumulated =
                await marketplace.fusyBenefitsAccumulated();

            expect(balanceOfMarketPlace.gte(BN.from(0))).to.be.true;
            expect(fusyBenefitsAccumulated).to.be.eq(BN.from(0));
            await expect(marketplace.withdraw()).to.be.revertedWith(
                "Marketplace: Nothing to withdraw."
            );
        });

        async function presetRequirements() {
            try {
                const collectionAddress =
                    mockERC1155CollectionDeployment.address;
                const nftId = 1;
                const price = ethers.utils.parseEther("1");
                const SELLER_SIGNER_INDEX = 1;
                const seller = await getAnotherSigner(SELLER_SIGNER_INDEX);
                await tSafeTransferFrom(signer, seller.address, nftId);
                await approveAndListingByASeller(
                    collectionAddress,
                    nftId,
                    price,
                    SELLER_SIGNER_INDEX
                );
                const BUYER_SIGNER_INDEX = 2;

                const marketplace =
                    getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
                const priceOffer = ethers.utils.parseEther("0.9");
                const durationInDays = 3;
                await tMakeOffer(
                    marketplace,
                    collectionAddress,
                    nftId,
                    priceOffer,
                    durationInDays
                );
            } catch (error) {
                console.error(error);
            }
        }

        it("Whether someone different to Marketplace's owner try to withdraw, then the transaction should revert.", async () => {
            const SELLER_SIGNER_INDEX = 1;
            let marketplace =
                getMarketplaceFromSignerIndex(SELLER_SIGNER_INDEX);

            await expect(marketplace.withdraw()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("After trade an NFT should be possible for the Marketplace's owner withdraw the fusyBenefitsAccumulated.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const SELLER_SIGNER_INDEX = 1;
            const seller = await getAnotherSigner(SELLER_SIGNER_INDEX);

            await tSafeTransferFrom(signer, seller.address, nftId);
            await approveAndListingByASeller(
                collectionAddress,
                nftId,
                price,
                SELLER_SIGNER_INDEX
            );

            const BUYER_SIGNER_INDEX = 2;
            let marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            const actualBalanceOfMarketplaceBeforeBuy = BigNumber.from(
                await ethers.provider.getBalance(marketplace.contract.address)
            );
            const _2percentPrice = _2percent.mul(price).div(twoUp64);
            const expectedBalanceOfMarketplace =
                actualBalanceOfMarketplaceBeforeBuy.add(_2percentPrice);

            await marketplace.buy(collectionAddress, nftId);
            const actualBalanceOfMarketplace = await ethers.provider.getBalance(
                marketplace.contract.address
            );
            const actualFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();
            expect(actualBalanceOfMarketplace).to.be.eq(
                expectedBalanceOfMarketplace
            );
            expect(actualFusyBenefitsAcc).to.be.eq(
                expectedBalanceOfMarketplace
            );
            marketplace = getMarketplaceForOwner();

            await expect(marketplace.withdraw()).to.be.not.reverted;
        });

        it("If there're various NFT listed and one of them is sold and another one has an offer, the fusyBenefitsAccumulated does not take into account the percent by offer made one.", async () => {
            const SELLER_1_SIGNER_INDEX = 1;
            const SELLER_2_SIGNER_INDEX = 3;
            const BUYER_1_SIGNER_INDEX = 2;
            const BUYER_2_SIGNER_INDEX = 4;
            const seller1 = await getAnotherSigner(SELLER_1_SIGNER_INDEX);
            const seller2 = await getAnotherSigner(SELLER_2_SIGNER_INDEX);
            const buyer1 = await getAnotherSigner(BUYER_1_SIGNER_INDEX);
            const buyer2 = await getAnotherSigner(BUYER_2_SIGNER_INDEX);
            const nftIds = [1, 2];
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            await tSafeTransferFrom(signer, seller1.address, nftIds[0]);
            await tSafeTransferFrom(signer, seller2.address, nftIds[1]);
            await approveAndListingByASeller(
                collectionAddress,
                nftIds[0],
                price,
                SELLER_1_SIGNER_INDEX
            );
            await approveAndListingByASeller(
                collectionAddress,
                nftIds[1],
                price,
                SELLER_2_SIGNER_INDEX
            );

            let marketplace =
                getMarketplaceFromSignerIndex(BUYER_1_SIGNER_INDEX);
            await marketplace.buy(collectionAddress, nftIds[0]);
            const expectedFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();

            marketplace = getMarketplaceFromSignerIndex(BUYER_2_SIGNER_INDEX);
            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftIds[1],
                priceOffer,
                durationInDays
            );

            const actualFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();

            expect(
                actualFusyBenefitsAcc,
                "Balance is not equal to the expected value."
            ).to.be.eq(expectedFusyBenefitsAcc);
        });

        it("After withdraw the fusyBenefitsAccumulated, it should down to 0 value.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(collectionAddress, nftId, price);

            const BUYER_SIGNER_INDEX = 1;
            let marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            await marketplace.buy(collectionAddress, nftId);
            marketplace = getMarketplaceForOwner();
            await marketplace.withdraw();
            const expectedFusyBenefitsAcc = "0";
            const actualFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();
            expect(
                actualFusyBenefitsAcc.toString(),
                "The fusyBenefitsAccumulated didn't down to 0 value."
            ).to.be.eq(expectedFusyBenefitsAcc);
        });
    });

    describe("MakeCounteroffer function tests", () => {
        const SELLER_SIGNER_INDEX = 1;
        let seller: SignerWithAddress;
        let marketplace: MarketplaceWrapperForOneSigner;
        const nftPrice = BN.from(100);
        const counterofferPrice = 91;
        let collectionAddress: Address;
        let helper: NftSaleHelper;

        beforeEach(async () => {
            seller = await getAnotherSigner(SELLER_SIGNER_INDEX);
            marketplace = getMarketplaceFromSignerIndex(SELLER_SIGNER_INDEX);
            collectionAddress = mockERC1155CollectionDeployment.address;
            helper = new NftSaleHelper(
                SELLER_SIGNER_INDEX,
                nftPrice,
                marketplace
            );
        });

        it("should revert if no NFT is listed from a collection", async () => {
            const notListedCollectionAddress = seller.address;

            await expect(
                marketplace.makeCounteroffer(notListedCollectionAddress)
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });

        it("should revert if the NFT ID is not listed for a collection with a previously listed NFT", async () => {
            const listedNftId = 1;

            await helper.setupAndMakeOffer(collectionAddress, listedNftId);

            const unlistedNftId = 2;

            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    unlistedNftId,
                    counterofferPrice
                )
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });

        it("should revert if the offer doesn't exist when the NFT does it", async () => {
            const nftId = 1;

            await helper.setupAndMakeOffer(collectionAddress, nftId);

            const unexistingOfferId = 1;
            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    BN.from(nftId),
                    unexistingOfferId
                )
            ).to.be.revertedWith("Marketplace: Offer not found");
        });

        it("should revert if the price is lower than the offer price", async () => {
            const nftId = 1;
            const offerPrice = 90;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId,
                offerPrice
            );

            const counterofferPrice = offerPrice - 1;
            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    BN.from(nftId),
                    offerId,
                    counterofferPrice
                )
            ).to.be.revertedWith(
                "Marketplace: Price must be greater than offer"
            );
        });

        it("should revert if the price is equal to the offer price", async () => {
            const nftId = 1;
            const offerPrice = 90;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId,
                offerPrice
            );

            const counterofferPrice = offerPrice;
            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    BN.from(nftId),
                    offerId,
                    counterofferPrice
                )
            ).to.be.revertedWith(
                "Marketplace: Price must be greater than offer"
            );
        });

        it("should revert if price is equal to NFT price", async () => {
            const nftId = 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId
            );

            const counterofferPrice = nftPrice;
            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    BN.from(nftId),
                    offerId,
                    counterofferPrice
                )
            ).to.be.revertedWith(
                "Marketplace: Price must be less than NFT price"
            );
        });

        it("should revert if price is greater than NFT price", async () => {
            const nftId = 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId
            );

            const counterofferPrice = nftPrice.add(1);
            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    BN.from(nftId),
                    offerId,
                    counterofferPrice
                )
            ).to.be.revertedWith(
                "Marketplace: Price must be less than NFT price"
            );
        });

        it("should revert if offer expired one second before the current block timestamp", async () => {
            const nftId = 1;
            const durationInDays = 1;
            const offerPrice = counterofferPrice - 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId,
                offerPrice,
                durationInDays
            );

            const durationInSeconds = durationInDays * ONE_DAY_IN_SECONDS;
            const BLOCK_MINED_BEFORE_NEXT_TRANSACTION = 1;
            await time.increase(
                durationInSeconds + 1 - BLOCK_MINED_BEFORE_NEXT_TRANSACTION
            );

            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    nftId,
                    offerId,
                    counterofferPrice
                )
            ).to.be.revertedWith("Marketplace: Offer expired");
        });

        it("should not revert if offer expires in the current block", async () => {
            const nftId = 1;
            const durationInDays = 1;
            const offerPrice = counterofferPrice - 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId,
                offerPrice,
                durationInDays
            );

            const durationInSeconds = durationInDays * ONE_DAY_IN_SECONDS;
            const BLOCK_MINED_BEFORE_NEXT_TRANSACTION = 1;
            await time.increase(
                durationInSeconds - BLOCK_MINED_BEFORE_NEXT_TRANSACTION
            );

            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    nftId,
                    offerId,
                    counterofferPrice
                )
            ).to.be.not.reverted;
        });

        it("should revert if the NFT is not being sold by the sender", async () => {
            const nftId = 1;

            await helper.setupAndMakeOffer(collectionAddress, nftId);

            const NOT_THE_SELLER_INDEX = 2;
            const notTheSellerApi =
                getMarketplaceFromSignerIndex(NOT_THE_SELLER_INDEX);

            await expect(
                notTheSellerApi.makeCounteroffer(
                    collectionAddress,
                    nftId,
                    0,
                    counterofferPrice
                )
            ).to.be.revertedWith("Marketplace: You aren't selling the NFT");
        });

        it("should save counteroffer price", async () => {
            const nftId = 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId
            );

            await marketplace.makeCounteroffer(
                collectionAddress,
                nftId,
                offerId,
                counterofferPrice
            );
            const counteroffer = await marketplace.getCounteroffer(
                collectionAddress,
                nftId,
                offerId
            );
            expect(counteroffer.price).to.be.eq(counterofferPrice);
        });

        it("should revert if there already is a counteroffer for an offer", async () => {
            const nftId = 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId
            );

            await marketplace.makeCounteroffer(
                collectionAddress,
                nftId,
                offerId,
                counterofferPrice
            );

            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    nftId,
                    offerId,
                    counterofferPrice
                )
            ).to.be.revertedWith("Marketplace: Counteroffer already exists");
        });

        it("should emit event CounterofferMade", async () => {
            const nftId = 1;

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId
            );

            const counterofferId = 1;
            await expect(
                marketplace.makeCounteroffer(
                    collectionAddress,
                    nftId,
                    offerId,
                    counterofferPrice
                )
            )
                .to.emit(marketplace.contract, "CounterofferMade")
                .withArgs(collectionAddress, nftId, offerId, counterofferId);
        });

        it("should make 2 counteroffers and set the ID of the 2nd to 2", async () => {
            const nftId = 1;

            await tSafeTransferFrom(signer, seller.address, nftId);
            await approveAndListingByASeller(
                collectionAddress,
                nftId,
                nftPrice,
                SELLER_SIGNER_INDEX
            );

            const offer1Price = 90;
            await makeOfferAndCounteroffer(nftId, offer1Price);

            const offer2Price = 93;
            const counteroffer2Id = await makeOfferAndCounteroffer(
                nftId,
                offer2Price
            );

            expect(counteroffer2Id).to.be.eq(2);
        });

        async function makeOfferAndCounteroffer(
            nftId: BigNumber | number,
            offerPrice: number
        ) {
            const { offerId } = await marketplace.makeOfferAndGetId(
                collectionAddress,
                nftId,
                offerPrice,
                3
            );
            const { counterofferId } =
                await marketplace.makeCounterofferAndGetId(
                    collectionAddress,
                    nftId,
                    offerId,
                    offerPrice + 1
                );
            return counterofferId;
        }
    });

    describe("TakeCounteroffer function tests", () => {
        const SELLER_SIGNER_INDEX = 1;
        let seller: SignerWithAddress;
        let buyer: SignerWithAddress;
        let marketplace: MarketplaceWrapperForOneSigner;
        let collectionAddress: Address;
        let helper: NftSaleHelper;
        const COUNTER_OFFER_DURATION_IN_DAYS = 3;
        const offerPrice = 90;
        let counterofferPrice: BigNumber;
        const nftId = 1;

        beforeEach(async () => {
            seller = await getAnotherSigner(SELLER_SIGNER_INDEX);
            const BUYER_SIGNER_INDEX = 2;
            buyer = await getAnotherSigner(BUYER_SIGNER_INDEX);

            marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            collectionAddress = mockERC1155CollectionDeployment.address;
            const nftPrice = BN.from(100);
            helper = new NftSaleHelper(
                SELLER_SIGNER_INDEX,
                nftPrice,
                marketplace
            );

            const offerId = await helper.setupAndMakeOffer(
                collectionAddress,
                nftId
            );

            counterofferPrice = nftPrice.sub(1);
            await makeCounteroffer(offerId);
        });

        async function makeCounteroffer(offerId: number) {
            const sellerMarketplace =
                getMarketplaceFromSignerIndex(SELLER_SIGNER_INDEX);
            await sellerMarketplace.makeCounteroffer(
                collectionAddress,
                nftId,
                offerId,
                counterofferPrice,
                COUNTER_OFFER_DURATION_IN_DAYS
            );
        }

        it("should revert if ID is zero", async () => {
            await expect(marketplace.takeCounteroffer(0)).to.be.revertedWith(
                "Marketplace: Counteroffer not found"
            );
        });

        it("should revert if ID is greater than total counteroffers", async () => {
            const TOTAL_COUNTER_OFFERS = 1;
            const id = TOTAL_COUNTER_OFFERS + 1;

            await expect(marketplace.takeCounteroffer(id)).to.be.revertedWith(
                "Marketplace: Counteroffer not found"
            );
        });

        it("should revert if sender didn't make the offer", async () => {
            const notTheOfferMakerApi =
                getMarketplaceFromSignerIndex(SELLER_SIGNER_INDEX);
            await expect(
                notTheOfferMakerApi.takeCounteroffer(1)
            ).to.be.revertedWith("Marketplace: You didn't make the offer");
        });

        it("should revert if counteroffer expired", async () => {
            await time.increase(
                COUNTER_OFFER_DURATION_IN_DAYS * ONE_DAY_IN_SECONDS
            );

            await expect(marketplace.takeCounteroffer(1)).to.be.revertedWith(
                "Marketplace: Counteroffer expired"
            );
        });

        it("should revert if sent value + offer price is less than counteroffer price", async () => {
            const insufficientValueToSend = counterofferPrice
                .sub(offerPrice)
                .sub(1);

            await expect(
                marketplace.takeCounteroffer(1, insufficientValueToSend)
            ).to.be.revertedWith("Marketplace: Insufficient funds");
        });

        it("should emit event CounterofferTaken", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);
            const counterofferId = 1;

            await expect(marketplace.takeCounteroffer(1, necessaryAmountToSend))
                .to.emit(marketplace.contract, "CounterofferTaken")
                .withArgs(counterofferId, counterofferPrice, seller.address);
        });

        it("should unlist NFT", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);

            await marketplace.takeCounteroffer(1, necessaryAmountToSend);

            const isListed = await marketplace.isListed(collectionAddress, 1);
            expect(isListed).to.be.false;
        });

        it("should increase NFT balance of buyer by 1", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);
            const mockErc1155 = await getErc1155Contract();

            const balanceBefore = await mockErc1155.balanceOf(
                buyer.address,
                nftId
            );

            await marketplace.takeCounteroffer(1, necessaryAmountToSend);

            const balanceAfter = await mockErc1155.balanceOf(
                buyer.address,
                nftId
            );
            expect(balanceAfter.sub(balanceBefore)).to.be.eq(1);
        });

        async function getErc1155Contract() {
            return (await ethers.getContract(
                "MockERC1155Collection"
            )) as MockERC1155Collection;
        }

        it("should decrease NFT balance of marketplace by 1", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);
            const mockErc1155 = await getErc1155Contract();

            const balanceBefore = await mockErc1155.balanceOf(
                marketplace.contract.address,
                nftId
            );

            await marketplace.takeCounteroffer(1, necessaryAmountToSend);

            const balanceAfter = await mockErc1155.balanceOf(
                marketplace.contract.address,
                nftId
            );
            expect(balanceBefore.sub(balanceAfter)).to.be.eq(1);
        });

        it("should transfer counteroffer price minus fee to seller", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);

            const fee = await marketplace.getFusyonaFeeFor(counterofferPrice);

            await expect(
                marketplace.takeCounteroffer(1, necessaryAmountToSend)
            ).to.changeEtherBalance(seller, counterofferPrice.sub(fee));
        });

        it("should only discount counterofferprice - offer price from buyer's balance", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);
            const moreThanNecessaryToSend = necessaryAmountToSend.add(1);

            await expect(
                marketplace.takeCounteroffer(1, moreThanNecessaryToSend)
            ).to.changeEtherBalance(buyer, `-${necessaryAmountToSend}`);
        });

        it("should emit event `NFTSold`", async () => {
            const necessaryAmountToSend = counterofferPrice.sub(offerPrice);

            await expect(marketplace.takeCounteroffer(1, necessaryAmountToSend))
                .to.emit(marketplace.contract, "NFTSold")
                .withArgs(
                    buyer.address,
                    seller.address,
                    collectionAddress,
                    nftId,
                    counterofferPrice
                );
        });
    });

    describe("ChangePriceOf function tests", () => {
        let seller: SignerWithAddress;
        let marketplace: MarketplaceWrapperForOneSigner;
        let collectionAddress: Address;
        const nftId = 1;
        const nftPrice = BN.from(100);
        const newPrice = nftPrice.add(100);

        beforeEach(async () => {
            const SELLER_SIGNER_INDEX = 1;
            seller = await getAnotherSigner(SELLER_SIGNER_INDEX);

            marketplace = getMarketplaceFromSignerIndex(SELLER_SIGNER_INDEX);
            collectionAddress = mockERC1155CollectionDeployment.address;

            await tSafeTransferFrom(signer, seller.address, nftId);

            await approveAndListingByASeller(
                collectionAddress,
                nftId,
                nftPrice,
                SELLER_SIGNER_INDEX
            );
        });

        it("should revert if no NFT is listed from a collection", async () => {
            const notListedCollectionAddress = seller.address;

            await expect(
                marketplace.changePriceOf(
                    notListedCollectionAddress,
                    nftId,
                    newPrice
                )
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });

        it("should revert if NFT is not listed", async () => {
            const notListedNftId = 2;

            await expect(
                marketplace.changePriceOf(
                    collectionAddress,
                    notListedNftId,
                    newPrice
                )
            ).to.be.revertedWith("Marketplace: NFT not listed");
        });

        it("should revert if the NFT is not being sold by the sender", async () => {
            const NOT_THE_SELLER_INDEX = 2;
            const notTheSellerApi =
                getMarketplaceFromSignerIndex(NOT_THE_SELLER_INDEX);

            await expect(
                notTheSellerApi.changePriceOf(
                    collectionAddress,
                    nftId,
                    newPrice
                )
            ).to.be.revertedWith("Marketplace: You aren't selling the NFT");
        });

        it("should revert if new price equals current price", async () => {
            await expect(
                marketplace.changePriceOf(collectionAddress, nftId, nftPrice)
            ).to.be.revertedWith(
                "Marketplace: New price is the same as current price"
            );
        });

        it("should change price of NFT", async () => {
            await marketplace.changePriceOf(collectionAddress, nftId, newPrice);

            const nftInfo = await marketplace.getNftInfo(
                collectionAddress,
                nftId
            );
            expect(nftInfo.price).to.be.eq(newPrice);
        });

        it("should emit event `NFTPriceChanged`", async () => {
            await expect(
                marketplace.changePriceOf(collectionAddress, nftId, newPrice)
            )
                .to.emit(marketplace.contract, "NFTPriceChanged")
                .withArgs(collectionAddress, nftId, newPrice);
        });
    });

    describe("TakeOffer function's tests", () => {
        let marketplace: MarketplaceWrapperForOneSigner;

        beforeEach(async () => {
            marketplace = getMarketplaceForOwner();
        });

        it("reverts if expirationDate is less than the current time.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );
            const daysPassed = 4;
            const daysPassedInSecondsInUnixTime =
                Math.floor(Date.now() / 1000) + daysPassed * ONE_DAY_IN_SECONDS;
            await time.increaseTo(daysPassedInSecondsInUnixTime);
            const indexOfOfferMapping = BN.from(0);
            await expect(
                marketplace.takeOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Offer expired");
        });
        it("reverts if signer of is not the seller", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const indexOfOfferMapping = BN.from(0);
            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );
            const NOT_THE_SELLER_INDEX = 1;
            const marketplace =
                getMarketplaceFromSignerIndex(NOT_THE_SELLER_INDEX);
            await expect(
                marketplace.takeOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Sender should be the seller");
        });

        it("reverts if the indexOfOfferMapping is greater than totalOffers", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const indexOfOfferMapping = BN.from(3);
            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );
            const BUYER_2_SIGNER_INDEX = 2;
            let marketplace =
                getMarketplaceFromSignerIndex(BUYER_2_SIGNER_INDEX);
            const priceOffer = ethers.utils.parseEther("0.98");
            const durationInDays = 3;
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                priceOffer,
                durationInDays
            );
            marketplace = getMarketplaceForOwner();
            await expect(
                marketplace.takeOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Offer doesn't exist");
        });

        async function presetRequirementsForThreeExpirationDays(
            collectionAddress: Address,
            nftId: number | BigNumber,
            price: BigNumber
        ) {
            await approveAndListingByTheOwner(collectionAddress, nftId, price);

            const BUYER_SIGNER_INDEX = 1;
            let marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);

            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                priceOffer,
                durationInDays
            );
        }

        async function approveAndListingByTheOwner(
            collectionAddress: Address,
            nftId: number | BigNumber,
            price: BigNumber
        ) {
            await approveAndListingByASeller(
                collectionAddress,
                nftId,
                price,
                OWNER_SIGNER_INDEX
            );
        }

        it("should unlist the NFT", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );
            const indexOfOfferMapping = BN.from(0);
            await marketplace.takeOffer(
                collectionAddress,
                nftId,
                indexOfOfferMapping
            );

            const nftInfo = await marketplace.getNftInfo(
                collectionAddress,
                nftId
            );
            expect(nftInfo.listed).to.be.false;
        });

        it("A seller can accept an offer if its expiration date is not reached yet.", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );
            const indexOfOfferMapping = BN.from(0);
            await expect(
                marketplace.takeOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.not.reverted;
        });

        it("should revert if the NFT was bought", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );

            const BUYER_SIGNER_INDEX = 1;
            const buyerApi = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            await buyerApi.buy(collectionAddress, nftId);

            const indexOfOfferMapping = BN.from(0);
            await expect(
                marketplace.takeOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: NFT not found");
        });

        it("should revert if offer was canceled", async () => {
            const nftId = 1;
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            await presetRequirementsForThreeExpirationDays(
                collectionAddress,
                nftId,
                price
            );

            const indexOfOfferMapping = BN.from(0);
            const OFFERER_SIGNER_ADDRESS = 1;
            const offererApi = getMarketplaceFromSignerIndex(
                OFFERER_SIGNER_ADDRESS
            );
            await offererApi.cancelOffer(
                collectionAddress,
                nftId,
                indexOfOfferMapping
            );

            await expect(
                marketplace.takeOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Offer was used");
        });
    });

    describe("SetFloorRatio function tests", () => {
        let marketplace: MarketplaceWrapperForOneSigner;

        beforeEach(async () => {
            marketplace = getMarketplaceForOwner();
        });

        it("should revert if sender is not the owner", async () => {
            const NOT_THE_OWNER_SIGNER_INDEX = 3;
            const marketplace = getMarketplaceFromSignerIndex(
                NOT_THE_OWNER_SIGNER_INDEX
            );

            await expect(
                marketplace.setFloorRatioFromPercentage(1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should revert if new percentage is greater than 100", async () => {
            await expect(
                marketplace.setFloorRatioFromPercentage(101)
            ).to.be.revertedWith(
                "Marketplace: Percentage must be less or equal than 100"
            );
        });

        it("should revert if new percentage is the same as the current one", async () => {
            const CURRENT_PERCENTAGE = 20;

            await expect(
                marketplace.setFloorRatioFromPercentage(CURRENT_PERCENTAGE)
            ).to.be.revertedWith(
                "Marketplace: New percentage is the same as the current one"
            );
        });

        it("should change value of floorRatio", async () => {
            const NEW_PERCENTAGE = 30;
            await expect(
                marketplace.setFloorRatioFromPercentage(NEW_PERCENTAGE)
            ).to.be.not.reverted;

            const EXPECTED_NEW_FLOOR_RATIO = toABDKMath64x64(NEW_PERCENTAGE);
            expect(await marketplace.floorRatio()).to.be.equal(
                EXPECTED_NEW_FLOOR_RATIO
            );
        });
    });

    describe("CancelOffer function's tests", () => {
        const SELLER_SIGNER_INDEX = 1;
        let seller: SignerWithAddress;

        const BUYER_SIGNER_INDEX = 2;
        let buyer: SignerWithAddress;

        const NOT_THE_BUYER_SIGNER_INDEX = 3;
        let imNotTheBuyer: Signer;

        let marketplace: MarketplaceWrapperForOneSigner;
        let collectionAddress: Address;
        let indexOfOfferMapping: number;
        const nftId = 1;
        const nftPrice = ethers.utils.parseEther("10");
        const newPrice = ethers.utils.parseEther("9");

        beforeEach(async () => {
            indexOfOfferMapping = 0;

            seller = await getAnotherSigner(SELLER_SIGNER_INDEX);

            buyer = await getAnotherSigner(BUYER_SIGNER_INDEX);
            marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);

            imNotTheBuyer = await getAnotherSigner(NOT_THE_BUYER_SIGNER_INDEX);

            collectionAddress = mockERC1155CollectionDeployment.address;
            await tSafeTransferFrom(signer, seller.address, nftId);

            await approveAndListingByASeller(
                collectionAddress,
                nftId,
                nftPrice,
                SELLER_SIGNER_INDEX
            );
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                newPrice,
                3
            );
        });

        it("should revert if the sender is not the buyer (offer's owner)", async () => {
            marketplace = getMarketplaceFromSignerIndex(
                NOT_THE_BUYER_SIGNER_INDEX
            );
            await expect(
                marketplace.cancelOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Wrong Buyer");
        });

        it("should revert if offer id doesn't exist.", async () => {
            indexOfOfferMapping = 1;
            await expect(
                marketplace.cancelOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Offer not found");
        });

        it("should not revert when the offer's owner (buyer) cancel the offer", async () => {
            await expect(
                marketplace.cancelOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.not.reverted;
        });

        it("should emit CancelledOffer event", async () => {
            await expect(
                marketplace.cancelOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            )
                .to.emit(marketplace.contract, "CancelledOffer")
                .withArgs(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping,
                    newPrice,
                    buyer.address
                );
        });

        it("should revert if buyer try to cancel an offer that was already cancelled", async () => {
            await marketplace.cancelOffer(
                collectionAddress,
                nftId,
                indexOfOfferMapping
            );
            await expect(
                marketplace.cancelOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Offer already was cancelled");
        });

        it("reverts if the offer was taken and the buyer try to cancel it", async () => {
            marketplace = getMarketplaceFromSignerIndex(SELLER_SIGNER_INDEX);
            await marketplace.takeOffer(
                collectionAddress,
                nftId,
                BN.from(indexOfOfferMapping)
            );
            marketplace = getMarketplaceFromSignerIndex(BUYER_SIGNER_INDEX);
            await expect(
                marketplace.cancelOffer(
                    collectionAddress,
                    nftId,
                    indexOfOfferMapping
                )
            ).to.be.revertedWith("Marketplace: Offer already was cancelled");
        });

        it("When an offer is cancelled, the money that collateralize it, it's go out from the Marketplace Contract.", async () => {
            await marketplace.cancelOffer(
                collectionAddress,
                nftId,
                indexOfOfferMapping
            );
            const expectedMarketplaceBalance = 0;
            const actualMarketplaceBalance = await ethers.provider.getBalance(
                marketplaceDeployment.address
            );
            expect(actualMarketplaceBalance).to.be.eq(
                expectedMarketplaceBalance
            );
        });
    });

    describe("SetFeeRatioFromPercentage function tests", () => {
        let marketplace: MarketplaceWrapperForOneSigner;

        beforeEach(async () => {
            marketplace = getMarketplaceForOwner();
        });

        it("should revert if sender is not the owner", async () => {
            const NOT_THE_OWNER_SIGNER_INDEX = 3;
            const marketplace = getMarketplaceFromSignerIndex(
                NOT_THE_OWNER_SIGNER_INDEX
            );

            await expect(
                marketplace.setFeeRatioFromPercentage(1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should revert if new percentage is greater than 100", async () => {
            await expect(
                marketplace.setFeeRatioFromPercentage(101)
            ).to.be.revertedWith(
                "Marketplace: Percentage must be less or equal than 100"
            );
        });

        it("should revert if new percentage is the same as the current one", async () => {
            const CURRENT_PERCENTAGE = 2;

            await expect(
                marketplace.setFeeRatioFromPercentage(CURRENT_PERCENTAGE)
            ).to.be.revertedWith(
                "Marketplace: New percentage is the same as the current one"
            );
        });

        it("should change value of feeRatio", async () => {
            const NEW_PERCENTAGE = 30;
            await expect(marketplace.setFeeRatioFromPercentage(NEW_PERCENTAGE))
                .to.be.not.reverted;

            const EXPECTED_NEW_FEE_RATIO = toABDKMath64x64(NEW_PERCENTAGE);
            expect(await marketplace.feeRatio()).to.be.equal(
                EXPECTED_NEW_FEE_RATIO
            );
        });
    });
});
