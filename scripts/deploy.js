const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy CertificateNFT
  const CertificateNFT = await hre.ethers.getContractFactory("CertificateNFT");
  console.log("Deploying CertificateNFT...");
  const certificateNFT = await CertificateNFT.deploy();
  await certificateNFT.waitForDeployment();
  const certificateAddress = await certificateNFT.getAddress();
  console.log("CertificateNFT deployed to:", certificateAddress);

  // Deploy PaymentTracker
  const PaymentTracker = await hre.ethers.getContractFactory("PaymentTracker");
  console.log("Deploying PaymentTracker...");
  const paymentTracker = await PaymentTracker.deploy();
  await paymentTracker.waitForDeployment();
  const paymentAddress = await paymentTracker.getAddress();
  console.log("PaymentTracker deployed to:", paymentAddress);

  console.log("\nDeployment complete! Set these addresses in your .env file:");
  console.log(`NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS=${certificateAddress}`);
  console.log(`NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS=${paymentAddress}`);

  // Optional: Verify the contracts on Snowtrace
  if (process.env.SNOWTRACE_API_KEY) {
    console.log("\nVerifying contracts on Snowtrace...");
    try {
      await hre.run("verify:verify", {
        address: certificateAddress,
        constructorArguments: []
      });
      console.log("CertificateNFT verified successfully");

      await hre.run("verify:verify", {
        address: paymentAddress,
        constructorArguments: []
      });
      console.log("PaymentTracker verified successfully");
    } catch (error) {
      console.log("Error verifying contracts:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
