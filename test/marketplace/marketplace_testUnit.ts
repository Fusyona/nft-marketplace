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
        await getDeployments();
        await getInstances();
        await defaultSigner();
        
    });

    async function defaultSigner() {
        const signers = await ethers.getSigners();
        signer = signers[0];
    }

    async function getDeployments() {
        await deployments.fixture(["Marketplace", "MockERC1155Collection"]);   
    }

    async function getInstances() {
        marketplaceDeployment = await deployments.get("Marketplace");
        mockERC1155CollectionDeployment = await deployments.get("MockERC1155Collection");
    }

    it("Marketplace should be deployed, therefore, it has linked an address", async () =>  {
        const zeroAddress = ethers.constants.AddressZero;
        const marketplaceAddress = marketplaceDeployment.address;
        assert.notEqual(marketplaceAddress, zeroAddress, "Wrong Marketplace address deployed");
    });

    it("A NFT should be listed using list function.", async () => {
        const marketplace = new Marketplace(marketplaceDeployment.address, signer);
        
        const tvlBeforeList = await marketplace.totalOfNFTListed();
        const _tvlBeforeList = BN.from(tvlBeforeList).toNumber();

        const collectionAddress = mockERC1155CollectionDeployment.address;
        const nftId = "1";
        const price = ethers.utils.parseEther("1");

        const mockCollection = await ethers.getContractAt("ERC1155", collectionAddress);
        
        await mockCollection.setApprovalForAll(marketplace.contractAddress, true);
        await marketplace.list(collectionAddress, nftId, price.toString());  

        const tvlAfterList = await marketplace.totalOfNFTListed();
        const _tvlAfterList = BN.from(tvlAfterList).toNumber();
        assert.equal(_tvlAfterList, _tvlBeforeList + 1, "_tvlAfterList should be increased plus one");
    });


});