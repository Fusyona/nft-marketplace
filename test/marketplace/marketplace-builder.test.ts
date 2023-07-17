import { expect } from "chai";
import MarketplaceWrapperForOneSigner_Builder from "../../scripts/marketplace-wrapper-for-one-signer.builder";

describe("Testing MarketplaceBuilder class", () => {
    it("should throw if contractAddress is undefined", () => {
        expect(() => {
            new MarketplaceWrapperForOneSigner_Builder()
                .withContractAbi({})
                .withProvider({})
                .build();
        }).to.throw("Missing mandatory parameter contractAddress");
    });

    it("should throw if contractAbi is undefined", () => {
        expect(() => {
            new MarketplaceWrapperForOneSigner_Builder()
                .withContractAddress("0x123")
                .withProvider({})
                .build();
        }).to.throw("Missing mandatory parameter contractAbi");
    });

    it("should throw if provider is undefined", () => {
        expect(() => {
            new MarketplaceWrapperForOneSigner_Builder()
                .withContractAddress("0x123")
                .withContractAbi({})
                .build();
        }).to.throw("Missing mandatory parameter provider");
    });
});
