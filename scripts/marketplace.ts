interface IMarketplace {
    contractAddress:string;
  

}

class Marketplace<IMarketplace> {
    contractAddress;
    constructor(contractAddress: string) {
        this.contractAddress = contractAddress;
    }

    liquidity() {

    }

    list(collectionAddress:string, nftId:string) {

    }
}

export {Marketplace}
