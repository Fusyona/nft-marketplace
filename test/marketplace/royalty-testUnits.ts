import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import {
  Fusy1155MockCollection,
  FusyERC721CollectionWithRoyaltySupport,
  Marketplace,
  IERC721
} from "../typechain-types";
import { Deployment } from "hardhat-deploy/dist/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("Royalty support tests", () => {
    const INTERFACE_ID_ERC2981 = "0x2a55205a";
    let BN = BigNumber;

    const CREATOR_INDEX_ACCOUNT = 1;
    let creator:SignerWithAddress;
    
    const SELLER_INDEX_ACCOUNT = 2;
    let seller: SignerWithAddress;

    const BUYER_INDEX_ACCOUNT = 3;
    let buyer: SignerWithAddress;

    const NOT_THE_BUYER_SIGNER_INDEX = 4;
    let imNotTheBuyer: Signer;

    let marketplaceDeployment: Deployment;
    let marketplace: Marketplace;
    let collectionContractWithoutERC2981: IERC721;
    let collectionContractWithERC2981: FusyERC721CollectionWithRoyaltySupport;
  
    let indexOfOfferMapping: number;
    let nftId = 1;
    const nftPrice = ethers.utils.parseEther("10");
    const newPrice = ethers.utils.parseEther("9");

    async function getCollectionWithoutERC2981() {
        await deployments.fixture(["MockERC721Collection"])
        let mockCollectionWitoutERC2981 = await deployments.get("MockERC721Collection"); 
        collectionContractWithoutERC2981 = await ethers.getContractAt("MockERC721Collection", mockCollectionWitoutERC2981.address);
        return collectionContractWithoutERC2981;
    }

    async function getCollectionWithERC2981() {
        await deployments.fixture(["FusyERC721CollectionWithRoyaltySupport"]);
        let mockCollectionERC2981Supported = await deployments.get("FusyERC721CollectionWithRoyaltySupport");
        collectionContractWithERC2981 = await ethers.getContractAt("FusyERC721CollectionWithRoyaltySupport", mockCollectionERC2981Supported.address);
        return collectionContractWithERC2981;
    }
    
    async function getMarketplaceDeployment() {
        await deployments.fixture(["Marketplace"]);
        return await deployments.get("Marketplace");
    }

    async function getAnotherSigner(x: number) {
        if (x === 0) {
            throw new Error("O is the defaultSigner's index.");
        }
        const signers = await ethers.getSigners();
        return signers[x] as unknown as SignerWithAddress;
    }

    beforeEach(async () => {
        creator = await getAnotherSigner(CREATOR_INDEX_ACCOUNT);
        seller = await getAnotherSigner(SELLER_INDEX_ACCOUNT);
        buyer = await getAnotherSigner(BUYER_INDEX_ACCOUNT);
        collectionContractWithoutERC2981 = await getCollectionWithoutERC2981();
        collectionContractWithERC2981 = await getCollectionWithERC2981();
        marketplaceDeployment = await getMarketplaceDeployment();
    });

    it("should return false while the marketplace check a collection address doesn't has support to ERC2981", async () => {
        expect(await collectionContractWithoutERC2981.supportsInterface(INTERFACE_ID_ERC2981)).to.be.false;
    });

    it("should return true if Marketplace check a collection address that it has support to ERC2981", async () => {
        expect(await collectionContractWithERC2981.supportsInterface(INTERFACE_ID_ERC2981)).to.be.true;
    });

    it("should emit RoyaltyPayment event", async () => {          
        marketplace = await ethers.getContractAt(marketplaceDeployment.abi, marketplaceDeployment.address, seller);
        await createAndApproveNFT(marketplaceDeployment.address);
        await listNft(marketplace);
        marketplace = await ethers.getContractAt(marketplaceDeployment.abi, marketplaceDeployment.address, buyer);       
        const royalty = nftPrice.div(10);
        await expect(marketplace.buy(collectionContractWithERC2981.address, nftId, {value: nftPrice})).to
        .emit(
            marketplace, "RoyaltyPayment"
        )
        .withArgs(collectionContractWithERC2981.address, nftId, creator.address, royalty);
    });

    async function createAndApproveNFT(marketplaceAddress:string) {
        try{
            await collectionContractWithERC2981.connect(seller).createNFT();
            await collectionContractWithERC2981.connect(seller).approve(marketplaceAddress, nftId);
        }catch(e){
            console.log(e);
        }
    }

    async function listNft(marketplace:Marketplace) {
        return await marketplace.list(collectionContractWithERC2981.address, nftId, nftPrice);
    }
    
    async function getBalance(addressAccount:string) {
        return await ethers.provider.getBalance(addressAccount);
    }

});