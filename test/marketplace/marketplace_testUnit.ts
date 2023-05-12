import {deployments, ethers} from "hardhat";
import {assert, expect} from "chai";
import {Marketplace} from "../../scripts/marketplace";
import { Contract, Signer, BigNumber } from "ethers";
import { Address, Deployment } from "hardhat-deploy/types";

describe("Testing Marketplace Smart Contract", () => {
    let signer:Signer;
    let marketplaceDeployment: Deployment;
    let mockERC1155CollectionDeployment:Deployment;
    
    let BN = BigNumber;

    beforeEach(async () => {
        await deployments.fixture(["Marketplace", "MockERC1155Collection"]); 
        await setInstances();
        await defaultSigner();
        
    });

    async function defaultSigner() {
        const signers = await ethers.getSigners();
        signer = signers[0];
    }

    async function getAnotherSigner(x:number){
        if (x===0) {
            throw new Error("O is the defaultSigner's index.");
        }
        const signers = await ethers.getSigners();
        return signers[x]
    }



    async function setInstances() {
        marketplaceDeployment = await deployments.get("Marketplace");
        mockERC1155CollectionDeployment = await deployments.get("MockERC1155Collection");
    }

    async function tApprove(marketplace:Marketplace) {
        const collectionAddress = mockERC1155CollectionDeployment.address;
        const mockCollection = await ethers.getContractAt("ERC1155", collectionAddress);
        await mockCollection.setApprovalForAll(marketplace.contractAddress, true);
        
    }

    async function tList(marketplace:Marketplace, collectionAddress:Address, nftId:string, price:string){
        await marketplace.list(collectionAddress, nftId, price);  
    }

    it("Marketplace should be deployed, therefore, it has linked an address", async () =>  {
        const zeroAddress = ethers.constants.AddressZero;
        const marketplaceAddress = marketplaceDeployment.address;
        assert.notEqual(marketplaceAddress, zeroAddress, "Wrong Marketplace address deployed");
    });

    describe("List functions's tests.", ()=> {
        it("A NFT should be listed using list function.", async () => {
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            
            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();
    
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId = "1";
            const price = ethers.utils.parseEther("1");
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());
    
            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();
            assert.equal(_tvlAfterList, _tvlBeforeList + 1, "_tvlAfterList should be increased plus one");
        });
    
        it("If there are more than two NFT in the marketplace the function totalOfNFTListed should returns 2", async () => {
            
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            
            const tvlBeforeList = await marketplace.totalOfNFTListed();
            const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();
    
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const nftId2 = "2";
            const price = ethers.utils.parseEther("1");
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId1, price.toString());
            await tList(marketplace, collectionAddress, nftId2, price.toString());
           
    
            const tvlAfterList = await marketplace.totalOfNFTListed();
            const _tvlAfterList = BN.from(tvlAfterList).toNumber();
           
            assert.equal(_tvlAfterList, _tvlBeforeList + 2, "_tvlAfterList should be increased plus two");
        });
    
        it("An exception should revert if an user try to list twice the same NFT.", async () => {
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const price = ethers.utils.parseEther("1");
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId1, price.toString());
            

            await expect (tList(marketplace, collectionAddress, nftId1, price.toString())).to.be.revertedWith(
                'Marketplace: Error when listed'
            );  
        
        });
    
        it("If an user owner of a NFT try to list that nft before it grants to Marketplace rigths over its token, then an exeception should be throwed.", async () => {
            const marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const collectionAddress = mockERC1155CollectionDeployment.address;
            const nftId1 = "1";
            const price = ethers.utils.parseEther("1");
            
            await expect(tList(marketplace, collectionAddress, nftId1, price.toString())).to.be.revertedWith(
                "ERC1155: caller is not token owner or approved"
                );  
        });
    
    });
    
    describe("Buy function's tests", () => {
        it("When a buyer pay the price of a NFT listed, the Marketplace send the NFT's ownership to buyer and the value of the item is transfered to seller", async () => {
            let marketplace = new Marketplace(marketplaceDeployment.address, signer);
            const nftId = "1";
            const price = ethers.utils.parseEther("1");

            const collectionAddress = mockERC1155CollectionDeployment.address;
            
            await tApprove(marketplace);
            await tList(marketplace, collectionAddress, nftId, price.toString());

            const buyer = await getAnotherSigner(1);
            marketplace = new Marketplace(marketplaceDeployment.address, buyer);

            const _tvlBeforeBuy = BN.from(await marketplace.totalOfNFTListed()).toNumber();
            await marketplace.buy(collectionAddress, nftId);
            const _tvlAfterBuy = BN.from(await marketplace.totalOfNFTListed()).toNumber();
            assert.equal(_tvlAfterBuy, (_tvlBeforeBuy - 1), "The totalOfNFTListed should decreased in less one.");


        });
    });

});