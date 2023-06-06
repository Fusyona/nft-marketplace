import { deployments, ethers } from "hardhat";
import { assert, expect } from "chai";
import { Marketplace } from "../../scripts/marketplace";
import { Contract, Signer, BigNumber } from "ethers";
import { Address, Deployment } from "hardhat-deploy/types";
import { ERC1155 } from "../../typechain-types";

describe("Testing Marketplace Smart Contract", () => {
    let signer: Signer;
    let marketplaceDeployment: Deployment;
    let mockERC1155CollectionDeployment: Deployment;

    let BN = BigNumber;
    const twoUp64 = BN.from(2).pow(64);
    const _2percent = BN.from(2).mul(twoUp64).div(BN.from(100));

    beforeEach(async () => {
        await deployments.fixture(["Marketplace", "MockERC1155Collection"]);
        await setInstances();
        await defaultSigner();
    });

    async function expectPromiseToFailWithMessage(
        fn: Function,
        messageToCatch: string
    ) {
        try {
            await fn();
        } catch (error: any) {
            const message =
                "Expected promise to fail with the specified error message";
            expect(messageToCatch, message).to.be.equal(error);
        }
    }

    async function defaultSigner() {
        const signers = await ethers.getSigners();
        signer = signers[0];
    }

    async function getAnotherSigner(x: number) {
        if (x === 0) {
            throw new Error("O is the defaultSigner's index.");
        }
        const signers = await ethers.getSigners();
        return signers[x];
    }

    async function setInstances() {
        marketplaceDeployment = await deployments.get("Marketplace");
        mockERC1155CollectionDeployment = await deployments.get(
            "MockERC1155Collection"
        );
    }

    async function tMakeOffer(
        marketplace: Marketplace,
        collectionAddress: Address,
        nftId: string,
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

    async function tApprove(marketplace: Marketplace, signer?: Signer) {
        try {
            await (
                await mockCollection(signer)
            ).setApprovalForAll(marketplace.contractAddress, true);
        } catch (error) {
            throw error;
        }
    }

    async function tSafeTransferFrom(
        signer: Signer,
        to: string,
        nftid: string
    ) {
        try {
            await (
                await mockCollection(signer)
            ).safeTransferFrom(await signer.getAddress(), to, nftid, "1", []);
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
            return mockCollection;
        } catch (error) {
            throw error;
        }
    }

    async function tList(
        marketplace: Marketplace,
        collectionAddress: Address,
        nftId: string,
        price: string
    ) {
        await marketplace.list(collectionAddress, nftId, price);
    }

    async function tBalanceOf(account: Address, nftId: string) {
        try {
            return await (await mockCollection()).balanceOf(account, nftId);
        } catch (error) {
            console.error(error);
        }
    }

    async function approveAndListingByASeller(
        seller: Signer,
        collectionAddress: Address,
        nftId: string,
        price: BigNumber
    ) {
        try {
            let marketplace = new Marketplace(
                marketplaceDeployment.address,
                seller
            );

            await tApprove(marketplace, seller);
            await tList(
                marketplace,
                collectionAddress,
                nftId,
                price.toString()
            );
        } catch (error) {
            throw error;
        }
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
        it("A NFT should be listed using list function.", async () => {
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );

            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();

            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();
            assert.equal(
                _tvlAfterList,
                _tvlBeforeList + 1,
                "_tvlAfterList should be increased plus one"
            );
        });

        it("If there are more than two NFT in the marketplace the function totalOfNFTListed should returns 2", async () => {
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );

            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();

            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const nftId2 = "2";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId1,
                price
            );
            await tList(
                marketplace,
                collectionAddress,
                nftId2,
                price.toString()
            );

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
            const nftId1 = "1";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId1,
                price
            );
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );
            expect(
                tList(marketplace, collectionAddress, nftId1, price.toString())
            ).to.be.revertedWith("Marketplace: Error when listed");
        });

        it("If an user owner of a NFT try to list that nft before it grants to Marketplace rigths over its token, then an exception should be thrown.", async () => {
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const price = ethers.utils.parseEther("1");

            expect(
                tList(marketplace, collectionAddress, nftId1, price.toString())
            ).to.be.revertedWith(
                "ERC1155: caller is not token owner or approved"
            );
        });
    });

    describe("Buy function's tests", () => {
        it("If one NFT is bought then the totalOfNFT listed should decrease in less one.", async () => {
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );

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
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );

            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            const actualBalanceOfMarketplaceBeforeBuy =
                await ethers.provider.getBalance(marketplace.contractAddress);
            const _2percentPrice = _2percent.mul(price).div(twoUp64);
            const expectedBalanceOfMarketplace =
                actualBalanceOfMarketplaceBeforeBuy.add(_2percentPrice);

            await marketplace.buy(collectionAddress, nftId);

            const actualBalanceOfMarketplace = await ethers.provider.getBalance(
                marketplace.contractAddress
            );
            assert.equal(
                actualBalanceOfMarketplace.toString(),
                expectedBalanceOfMarketplace.toString(),
                "The balance of Marketplace is not equal to 2%NFTprice."
            );
        });

        it("After the purchase the Seller's ether balance should increase in NFTprice - 2%NFTprice.", async () => {
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const _2percentPrice = _2percent.mul(price).div(twoUp64);

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const balanceOfSellerAfterList = await ethers.provider.getBalance(
                await signer.getAddress()
            );
            const expectedBalanceOfSeller = balanceOfSellerAfterList.add(
                price.sub(_2percentPrice)
            );

            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );

            await marketplace.buy(collectionAddress, nftId);

            const actualBalanceOfSeller = await ethers.provider.getBalance(
                await signer.getAddress()
            );

            assert.equal(
                actualBalanceOfSeller.toString(),
                expectedBalanceOfSeller.toString(),
                "The balance of Seller is not equal to NFTprice - 2%NFTprice."
            );
        });

        it("Buyer's NFT balance previously to the purchase should be equal to 0.", async () => {
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);

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
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );

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
            const nftId = "1";
            const price = ethers.utils.parseEther("10000.1");

            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );

            const wrappedFunction = async () => {
                await marketplace.buy(collectionAddress, nftId);
            };
            expect(wrappedFunction).to.throw;
        });

        it("If a buyer try to buy an unlisted token, the transaction should revert.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            const nftId = "1";

            const wrappedBuy = async () => {
                await marketplace.buy(collectionAddress, nftId);
            };

            await expectPromiseToFailWithMessage(
                wrappedBuy,
                "NFT has not been listed yet"
            );
        });

        it("After unlisted a NFT it's not possible make the same purchase, avoiding double spent.", async () => {
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const scammer = await getAnotherSigner(2);

            let marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            await marketplace.buy(collectionAddress, nftId);

            marketplace = new Marketplace(
                marketplaceDeployment.address,
                scammer
            );
            const wrappedBuy = async () => {
                await marketplace.buy(collectionAddress, nftId);
            };

            await expectPromiseToFailWithMessage(
                wrappedBuy,
                "NFT has not been listed yet"
            );
        });
    });

    describe("MakeOffer function's tests. ", () => {
        it("A user can make an offer over a NFT that it already was listed.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
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
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            const priceOffer = ethers.utils.parseEther("0.9");
            const durationInDays = 3;
            const expectedBalanceOfMarketplace = (
                await ethers.provider.getBalance(marketplace.contractAddress)
            ).add(priceOffer);
            await tMakeOffer(
                marketplace,
                collectionAddress,
                nftId,
                priceOffer,
                durationInDays
            );
            const actualBalanceOfMarketplace = await ethers.provider.getBalance(
                marketplace.contractAddress
            );
            expect(
                actualBalanceOfMarketplace.toString(),
                "Balance of Marketplace should increase in price offer."
            ).to.be.eq(expectedBalanceOfMarketplace.toString());
        });

        it("After a buyer make an offer, he hasn't the NFT's ownership yet.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
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
                marketplace.contractAddress,
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
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
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
            ).to.be.revertedWith("Marketplace: Error trying to make an offer.");
        });

        it("The transaction should reverts if a buyer try to make an offer over an unlisted NFT.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const buyer = await getAnotherSigner(1);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            const nftId = "1";
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
            ).to.be.revertedWith("Marketplace: Error trying to make an offer.");
        });
    });

    describe("Escrow functions's tests", () => {
        it("Whether there's not sales, the fusyBenefitsAccumulated should be equal to 0.", async () => {
            await presetRequirements();
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );
            const expectedFusyBenefitsAcc = "0";
            const actualFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();
            expect(actualFusyBenefitsAcc.toString()).to.be.eq(
                expectedFusyBenefitsAcc
            );
        });
        it("The withdraw transaction should revert if the balance of Marketplace is greater than 0 and the fusyBenefitsAccumulated is 0.", async () => {
            await presetRequirements();

            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );
            const balanceOfMarketPlace = await ethers.provider.getBalance(
                marketplaceDeployment.address
            );
            const fusyBenefitsAccumulated =
                await marketplace.fusyBenefitsAccumulated();
            await expect(balanceOfMarketPlace).to.be.greaterThan(BN.from(0));
            await expect(fusyBenefitsAccumulated).to.be.eq(BN.from(0));
            await expect(marketplace.withdraw()).to.be.revertedWith(
                "Marketplace: Nothing to withdraw."
            );
        });

        async function presetRequirements() {
            try {
                const collectionAddress =
                    mockERC1155CollectionDeployment.address;
                const nftId = "1";
                const price = ethers.utils.parseEther("1");
                const seller = await getAnotherSigner(1);
                await tSafeTransferFrom(signer, seller.address, nftId);
                await approveAndListingByASeller(
                    seller,
                    collectionAddress,
                    nftId,
                    price
                );
                const buyer = await getAnotherSigner(2);

                const marketplace = new Marketplace(
                    marketplaceDeployment.address,
                    buyer
                );
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
            const seller = await getAnotherSigner(1);
            let marketplace = new Marketplace(
                marketplaceDeployment.address,
                seller
            );

            await expect(marketplace.withdraw()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });
        it("After trade an NFT should be possible for the Marketplace's owner withdraw the fusyBenefitsAccumulated.", async () => {
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const seller = await getAnotherSigner(1);

            await tSafeTransferFrom(signer, seller.address, nftId);
            await approveAndListingByASeller(
                seller,
                collectionAddress,
                nftId,
                price
            );

            const buyer = await getAnotherSigner(2);
            const marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            const actualBalanceOfMarketplaceBeforeBuy =
                await ethers.provider.getBalance(marketplace.contractAddress);
            const _2percentPrice = _2percent.mul(price).div(twoUp64);
            const expectedBalanceOfMarketplace =
                actualBalanceOfMarketplaceBeforeBuy.add(_2percentPrice);

            await marketplace.buy(collectionAddress, nftId);
            const actualBalanceOfMarketplace = await ethers.provider.getBalance(
                marketplace.contractAddress
            );
            const actualFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();
            expect(actualBalanceOfMarketplace).to.be.eq(
                expectedBalanceOfMarketplace
            );
            expect(actualFusyBenefitsAcc).to.be.eq(
                expectedBalanceOfMarketplace
            );
            await expect(marketplace.withdraw()).to.be.ok;
        });

        it("If there're various NFT listed and one of them is sold and another one has an offer, the fusyBenefitsAccumulated does not take into account the percent by offer made one.", async () => {
            const seller1 = await getAnotherSigner(1);
            const seller2 = await getAnotherSigner(3);
            const buyer1 = await getAnotherSigner(2);
            const buyer2 = await getAnotherSigner(4);
            const nftIds = ["1", "2"];
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;
            await tSafeTransferFrom(signer, seller1.address, nftIds[0]);
            await tSafeTransferFrom(signer, seller2.address, nftIds[1]);
            await approveAndListingByASeller(
                seller1,
                collectionAddress,
                nftIds[0],
                price
            );
            await approveAndListingByASeller(
                seller2,
                collectionAddress,
                nftIds[1],
                price
            );

            let marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer1
            );
            await marketplace.buy(collectionAddress, nftIds[0]);
            const expectedFusyBenefitsAcc =
                await marketplace.fusyBenefitsAccumulated();

            marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer2
            );
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
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            const collectionAddress = mockERC1155CollectionDeployment.address;

            await approveAndListingByASeller(
                signer,
                collectionAddress,
                nftId,
                price
            );

            const buyer = await getAnotherSigner(1);
            let marketplace = new Marketplace(
                marketplaceDeployment.address,
                buyer
            );
            await marketplace.buy(collectionAddress, nftId);
            marketplace = new Marketplace(
                marketplaceDeployment.address,
                signer
            );
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
});
