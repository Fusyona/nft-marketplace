import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    FusyERC721CollectionWithRoyaltySupport,
    Marketplace,
    IERC721,
} from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Royalty support tests", () => {
    const INTERFACE_ID_ERC2981 = "0x2a55205a";
    const CREATOR_INDEX_ACCOUNT = 1;
    let creator: SignerWithAddress;

    const SELLER_INDEX_ACCOUNT = 2;
    let seller: SignerWithAddress;

    const BUYER_INDEX_ACCOUNT = 3;
    let buyer: SignerWithAddress;

    let marketplace: Marketplace;
    let collectionContractWithoutERC2981: IERC721;
    let collectionContractWithERC2981: FusyERC721CollectionWithRoyaltySupport;

    let nftId = 1;
    const nftPrice = ethers.utils.parseEther("10");

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        creator = signers[CREATOR_INDEX_ACCOUNT];
        seller = signers[SELLER_INDEX_ACCOUNT];
        buyer = signers[BUYER_INDEX_ACCOUNT];

        await deployments.fixture([
            "MockERC721Collection",
            "FusyERC721CollectionWithRoyaltySupport",
            "Marketplace",
        ]);

        collectionContractWithoutERC2981 = await ethers.getContract(
            "MockERC721Collection"
        );
        collectionContractWithERC2981 = await ethers.getContract(
            "FusyERC721CollectionWithRoyaltySupport"
        );
        marketplace = await ethers.getContract("Marketplace");
    });

    it("should return false while the marketplace check a collection address doesn't has support to ERC2981", async () => {
        expect(
            await collectionContractWithoutERC2981.supportsInterface(
                INTERFACE_ID_ERC2981
            )
        ).to.be.false;
    });

    it("should return true if Marketplace check a collection address that it has support to ERC2981", async () => {
        expect(
            await collectionContractWithERC2981.supportsInterface(
                INTERFACE_ID_ERC2981
            )
        ).to.be.true;
    });

    it("should emit RoyaltyPayment event", async () => {
        await createAndApproveNFT(marketplace.address);
        await listNft(marketplace);
        const royalty = nftPrice.div(10);
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

    async function createAndApproveNFT(marketplaceAddress: string) {
        await collectionContractWithERC2981.connect(seller).createNFT();
        await collectionContractWithERC2981
            .connect(seller)
            .approve(marketplaceAddress, nftId);
    }

    async function listNft(marketplace: Marketplace) {
        return await marketplace
            .connect(seller)
            .list(collectionContractWithERC2981.address, nftId, nftPrice);
    }
});
