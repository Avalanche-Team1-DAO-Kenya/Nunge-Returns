import hre from "hardhat";
import fs from 'fs';

async function main() {
    const logs = [];
    const [deployer] = await hre.ethers.getSigners();
    logs.push(`Testing with account: ${deployer.address}`);
    logs.push(`Account balance: ${(await deployer.provider.getBalance(deployer.address)).toString()}`);

    try {
        // Get contract instances
        const certificateAddress = process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS;
        const paymentAddress = process.env.NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS;

        const CertificateNFT = await hre.ethers.getContractFactory("CertificateNFT");
        const PaymentTracker = await hre.ethers.getContractFactory("PaymentTracker");

        const certificateContract = CertificateNFT.attach(certificateAddress);
        const paymentContract = PaymentTracker.attach(paymentAddress);

        // Test data
        const testPin = "TEST123456";
        const sessionId = "TEST" + Date.now();
        const amount = hre.ethers.parseEther("0.0000001"); // Very small amount
        const paymentRef = "PAY" + Date.now();

        logs.push("\nCreating session...");
        logs.push(`Session ID: ${sessionId}`);
        logs.push(`Amount: ${hre.ethers.formatEther(amount)} AVAX`);

        // Create session
        const tx1 = await paymentContract.createSession(sessionId, testPin, amount);
        await tx1.wait();
        logs.push(`Session created. Tx: ${tx1.hash}`);

        // Record payment
        logs.push("\nRecording payment...");
        const tx2 = await paymentContract.recordPayment(sessionId, paymentRef);
        await tx2.wait();
        logs.push(`Payment recorded. Tx: ${tx2.hash}`);

        // Update status to completed
        logs.push("\nUpdating session status...");
        const tx3 = await paymentContract.updateSessionStatus(sessionId, 2); // 2 = Completed
        await tx3.wait();
        logs.push(`Status updated. Tx: ${tx3.hash}`);

        // Mint certificate
        logs.push("\nMinting certificate...");
        const tx4 = await certificateContract.safeMint(
            deployer.address,
            testPin,
            sessionId,
            "ipfs://QmTest"
        );
        await tx4.wait();
        logs.push(`Certificate minted. Tx: ${tx4.hash}`);

        // Get session details
        logs.push("\nFetching session details...");
        const session = await paymentContract.getSession(sessionId);
        logs.push("Session: " + JSON.stringify({
            kraPin: session.kraPin,
            amount: hre.ethers.formatEther(session.amount),
            status: ["Created", "PaymentReceived", "Completed", "Failed"][session.status],
            paymentReference: session.paymentReference
        }, null, 2));

        // Get filing history
        logs.push("\nFetching filing history...");
        const history = await paymentContract.getFilingHistory(testPin);
        logs.push(`History entries: ${history.length}`);

        logs.push("\nTest completed successfully!");

        // Write all logs to file
        fs.writeFileSync('test-results.json', JSON.stringify({
            timestamp: new Date().toISOString(),
            success: true,
            logs: logs
        }, null, 2));

    } catch (error) {
        logs.push("\nTest failed!");
        logs.push(error.toString());
        
        // Write error logs to file
        fs.writeFileSync('test-results.json', JSON.stringify({
            timestamp: new Date().toISOString(),
            success: false,
            logs: logs,
            error: error.toString()
        }, null, 2));
        
        process.exitCode = 1;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        fs.writeFileSync('test-results.json', JSON.stringify({
            timestamp: new Date().toISOString(),
            success: false,
            error: error.toString()
        }, null, 2));
        process.exit(1);
    });
