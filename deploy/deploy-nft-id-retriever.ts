import { ethers } from "hardhat";

async function main() {    

    const NftIdRetriever = await ethers.getContractFactory("NftIdRetriever");
    const retriever = await NftIdRetriever.deploy();        
     
    console.log("Contract deployed with address", retriever.address);    
}
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });