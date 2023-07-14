import Web3 from "web3";
import Marketplace from "./marketplace";

export default class MarketplaceBuilder {
    private contractAddress: string | undefined;
    private contractAbi: any;
    private web3: Web3 | undefined;
    private signerIndex = 0;
    confirmations: number | undefined;

    usingContractAddress(contractAddress: string) {
        this.contractAddress = contractAddress;
        return this;
    }

    usingContractAbi(contractAbi: any) {
        this.contractAbi = contractAbi;
        return this;
    }

    usingWeb3(web3: Web3) {
        this.web3 = web3;
        return this;
    }

    usingSignerIndex(signerIndex: number) {
        this.signerIndex = signerIndex;
        return this;
    }

    usingConfirmations(confirmations: number) {
        this.confirmations = confirmations;
        return this;
    }

    build() {
        return new Marketplace(
            this.contractAddress!,
            this.contractAbi!,
            this.web3!,
            this.signerIndex,
            this.confirmations
        );
    }
}
