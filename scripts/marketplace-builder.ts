import Web3 from "web3";
import Marketplace from "./marketplace";

export default class MarketplaceBuilder {
    private contractAddress: string | undefined;
    private contractAbi: any;
    private web3: Web3 | undefined;
    private signerIndex = 0;
    confirmations: number | undefined;

    withContractAddress(contractAddress: string) {
        this.contractAddress = contractAddress;
        return this;
    }

    withContractAbi(contractAbi: any) {
        this.contractAbi = contractAbi;
        return this;
    }

    withWeb3(web3: Web3) {
        this.web3 = web3;
        return this;
    }

    withSignerIndex(signerIndex: number) {
        this.signerIndex = signerIndex;
        return this;
    }

    withConfirmations(confirmations: number) {
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
