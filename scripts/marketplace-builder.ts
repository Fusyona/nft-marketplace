import Marketplace from "./marketplace";
import { ExternalProvider, JsonRpcFetchFunc } from "@ethersproject/providers";

export default class MarketplaceBuilder {
    private contractAddress: string | undefined;
    private contractAbi: any;
    private provider: ExternalProvider | JsonRpcFetchFunc | undefined;
    private signerIndex = 0;
    private confirmations: number | undefined;

    withContractAddress(contractAddress: string) {
        this.contractAddress = contractAddress;
        return this;
    }

    withContractAbi(contractAbi: any) {
        this.contractAbi = contractAbi;
        return this;
    }

    withProvider(provider: ExternalProvider | JsonRpcFetchFunc) {
        this.provider = provider;
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
        this.ensureMandatoryParameters();

        return new Marketplace(
            this.contractAddress!,
            this.contractAbi!,
            this.provider!,
            this.signerIndex,
            this.confirmations
        );
    }

    private ensureMandatoryParameters() {
        const mandatoryParameters = [
            "contractAddress",
            "contractAbi",
            "provider",
        ];
        for (const parameter of mandatoryParameters) {
            this.throwIfParameterUndefined(parameter);
        }
    }

    private throwIfParameterUndefined(parameterKey: string) {
        const indexedThis = this as Record<string, any>;
        if (typeof indexedThis[parameterKey] === "undefined") {
            throw new Error(`Missing mandatory parameter ${parameterKey}`);
        }
    }
}
