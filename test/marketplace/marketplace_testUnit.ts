import {deployments, ethers} from "hardhat";
import {assert, expect} from "chai";


describe("Testing Marketplace Smart Contract", () => {
    
    beforeEach(async () => {
        await deployments.fixture("Marketplace");
    });

    it("Marketplace should be deployed, therefore, it has linked an address", async () =>  {
        const zeroAddress = ethers.constants.AddressZero;
        const maketplaceDeployment = await deployments.get("Marketplace");
        const markplaceAddress = maketplaceDeployment.address;
        assert.notEqual(markplaceAddress, zeroAddress, "Wron Marketplace address deployed");
    });
});