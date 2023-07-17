import { expect } from "chai";
import MarketplaceBuilder from "../../scripts/marketplace-builder";

describe("Testing MarketplaceBuilder class", () => {
    it("should throw if contractAddress is undefined", () => {
        expect(() => {
            new MarketplaceBuilder()
                .withContractAbi({})
                .withProvider({})
                .build();
        }).to.throw("Missing mandatory parameter contractAddress");
    });

    it("should throw if contractAbi is undefined", () => {
        expect(() => {
            new MarketplaceBuilder()
                .withContractAddress("0x123")
                .withProvider({})
                .build();
        }).to.throw("Missing mandatory parameter contractAbi");
    });

    it("should throw if provider is undefined", () => {
        expect(() => {
            new MarketplaceBuilder()
                .withContractAddress("0x123")
                .withContractAbi({})
                .build();
        }).to.throw("Missing mandatory parameter provider");
    });
});
