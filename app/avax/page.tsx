'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CertificateManager } from "@/components/avax/CertificateManager"
import { CartManager } from "@/components/avax/CartManager"
import { PaymentHistory } from "@/components/avax/PaymentHistory"
import { BlockchainLogs } from "@/components/avax/BlockchainLogs"
import { useEffect, useState } from "react"
import { blockchainService } from "@/services/blockchainService"

export default function AvaxPage() {
    // Hardcoded organization address
    const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

    return (
        <div className="container mx-auto p-4 space-y-8">
            <h1 className="text-4xl font-bold mb-8">Avalanche Integration</h1>
            
            <Tabs defaultValue="certificates" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="certificates">Certificates</TabsTrigger>
                    <TabsTrigger value="cart">Cart Management</TabsTrigger>
                    <TabsTrigger value="payments">Payment History</TabsTrigger>
                    <TabsTrigger value="logs">Blockchain Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="certificates">
                    <CertificateManager address={address} />
                </TabsContent>

                <TabsContent value="cart">
                    <CartManager address={address} />
                </TabsContent>

                <TabsContent value="payments">
                    <PaymentHistory address={address} />
                </TabsContent>

                <TabsContent value="logs">
                    <BlockchainLogs />
                </TabsContent>
            </Tabs>
        </div>
    )
}
