import {deployments, ethers} from "hardhat";
import {assert, expect} from "chai";
import {Marketplace} from "../../scripts/marketplace";
import { Signer } from "ethers";

describe("Testing Marketplace Smart Contract", () => {
    let signer:Signer;
    
    beforeEach(async () => {
        await deployments.fixture("Marketplace");
        await defaultSigner();
    });

    async function defaultSigner() {
        const signers = await ethers.getSigners();
        signer = signers[0];
    }

    it("Marketplace should be deployed, therefore, it has linked an address", async () =>  {
        const zeroAddress = ethers.constants.AddressZero;
        const maketplaceDeployment = (await deployments.get("Marketplace"));
        const marketplaceAddress = maketplaceDeployment.address;
        assert.notEqual(marketplaceAddress, zeroAddress, "Wrong Marketplace address deployed");
    });

    it("A NFT should be listed using list function.", async () => {
        const marketplaceDeployment = await deployments.get("Marketplace");
        const marketplace = new Marketplace(marketplaceDeployment.address, signer);
        const currentLiquidity = await marketplace.liquidity();
        const collectionAddress = "";
        const nftId = "";
        await marketplace.list(collectionAddress, nftId);
        const liquidityAfterList = await marketplace.liquidity();
        expect(liquidityAfterList, "This value should be increased in plus one.").greaterThan(currentLiquidity);
    });


});