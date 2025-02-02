import hre from "hardhat";
import fs from 'fs';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployLog = [];
  
  deployLog.push(`Deploying contracts with account: ${deployer.address}`);
  const balance = await deployer.provider.getBalance(deployer.address);
  deployLog.push(`Account balance: ${balance.toString()}`);

  try {
    // Deploy CertificateNFT
    deployLog.push('Deploying CertificateNFT...');
    const CertificateNFT = await hre.ethers.getContractFactory("CertificateNFT");
    const certificateNFT = await CertificateNFT.deploy();
    await certificateNFT.waitForDeployment();
    const certificateAddress = await certificateNFT.getAddress();
    deployLog.push(`CertificateNFT deployed to: ${certificateAddress}`);

    // Deploy PaymentTracker
    deployLog.push('Deploying PaymentTracker...');
    const PaymentTracker = await hre.ethers.getContractFactory("PaymentTracker");
    const paymentTracker = await PaymentTracker.deploy();
    await paymentTracker.waitForDeployment();
    const paymentAddress = await paymentTracker.getAddress();
    deployLog.push(`PaymentTracker deployed to: ${paymentAddress}`);

    // Write deployment addresses to a file
    const deploymentInfo = {
      certificateNFT: certificateAddress,
      paymentTracker: paymentAddress,
      deployedAt: new Date().toISOString(),
      network: hre.network.name
    };

    fs.writeFileSync(
      'deployment.json',
      JSON.stringify(deploymentInfo, null, 2)
    );

    deployLog.push('\nDeployment Summary:');
    deployLog.push('===================');
    deployLog.push(`CertificateNFT: ${certificateAddress}`);
    deployLog.push(`PaymentTracker: ${paymentAddress}`);
    deployLog.push('\nAdd these to your .env file:');
    deployLog.push(`NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS=${certificateAddress}`);
    deployLog.push(`NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS=${paymentAddress}`);

    // Write all logs at once
    console.log(deployLog.join('\n'));

  } catch (error) {
    console.error('\nDeployment failed!');
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
